/*
    This script will automatically check job queue based on the schedule to pick up a job for an asset.
    When a job is picked up for the asset, it will do a series of validation based on the available cash,
    and purchase the items from the market place by creating an oder, pay for the product by bitcoin, evaluate if
    the file is a valid design, then send the file to the printer if it passed the validation process.
 */

//Adding the required javascript modules
//var chainpointvalidate = require('chainpoint-validate');
var chainpointvalidate = require('chainpoint-client')
var crypto = require('crypto');
var fs = require("fs");
var http = require('http');
var deasync = require('deasync');
var createtx = require("./create_tx.js");
var ws = require("./ws.js");
var location = process.env.location;
var printer = process.env.printer;

function busysleep(waitMsec) {
  var startMsec = new Date();
  while (new Date() - startMsec < waitMsec);
}

verify1 = function(fileName, targetHash) {
    //Reading the information from the reciept and building the proper chainpoint json
    var proof = fs.readFileSync(fileName);
    var proofs = [proof]; 
    //Calling the chainpoint function to validate the reciept built from the certificates
    var proofVerifies = chainpointvalidate.proof(proofs);
    if ((proofVerifies.length == 2) && (proofVerifies[1].verified))
	return true;
    else return false;
}

async function verify(fileName, targetHash) {
    //Reading the information from the reciept and building the proper chainpoint json
//    var proof = fs.readFileSync(fileName);
 //   var proofs = [proof];
    //Calling the chainpoint function to validate the reciept built from the certificates
  //  var proofVerifies = chainpointvalidate.proof(proofs);
proofs = [JSON.parse(fs.readFileSync(fileName)).proof];
//    if ((proofVerifies.length == 2) && (proofVerifies[1].verified))
//      return true;
//    else return false;
console.log("Begining invoking chainpoint...");
    const chainpointvalidate = require('chainpoint-client');
    let proofVerifies = await chainpointvalidate.verifyProofs(proofs);

    while (proofVerifies == null) {
        deasync.sleep(50);
    }


    if ((proofVerifies.length == 2) && (proofVerifies[1].verified))
    {
        console.log("Proof is success!!!");
        console.log("proofVerifies: " + JSON.stringify(proofVerifies));
        return true;
    }
    else {
        console.log("Proof is not success!")
        return false;
    }
}

module.exports.availableQueueJobs = function(restOptions, location, dimension1, dimension2, dimension3) {
    // Printout the parameters:
    console.log('Parameters to find the available queue jobs');
    console.log('Host:' + restOptions['host']);
    console.log('Port:' + restOptions['port']);
    console.log('restOptions' + JSON.stringify(restOptions));
    var path = '/queue/availableElements/' + location + '/' + dimension1 + '/' + dimension2 + '/' + dimension3;
    console.log('path: ' + path);
    restOptions['path'] = path;
    restOptions['method'] = 'GET';
    var jobs;
    var availableJobsRequest = http.request(restOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            jobs = JSON.parse(msg);
            console.log('Available Jobs: ' + JSON.stringify(jobs));
        });
    });
    availableJobsRequest.end();
    while (jobs == null) {
        deasync.sleep(50);
    }
    return jobs;
}

module.exports.selectJob = function(jobs, restOptions, assetID, bitCoinToUSD, printerCondition){
    restOptions['path'] = '/asset/' + assetID;
    restOptions['method'] = 'GET';
    //Find out how much money the asset has
    var coinsRemaining;
    var coinsRemainingRequest = http.request(restOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            coinsRemaining = JSON.parse(msg).coinsRemaining;
            console.log('Assets Coins Remaining : ' + coinsRemaining);
        });
    });
    coinsRemainingRequest.end();
    while (coinsRemaining == null) {
        deasync.sleep(50);
    }
    //Checks each job to see if the asset has the money to purchase it
    //Picks the one with the highest priority that it can afford
    var jobLength = jobs.length;
    var currentJob;
    for (i=0; i<jobLength; i++) {
console.log("selecting.. " + printer);
        var job = jobs[i];
        var cost = job.price;
console.log("selecting.. " + job.dimension1);
/*
        if (parseFloat(cost) * bitCoinToUSD < parseFloat(coinsRemaining ))
        {
            currentJob = job;
            console.log('Asset has enough money to do this job: job prioritynum =' + job.prioritynum + ' cost=' +cost + ',coinsRemaining=' + coinsRemaining) ;
            break;
        }
*/
        if (printer == '1' && parseFloat(job.dimension1) > 39.0) {
            currentJob = job;
            break;
        }
        if (printer == '2' && parseFloat(job.dimension1) < 21.0) {
            currentJob = job;
            break;
        }
        if (printer == '0' || printer == '3') {
            currentJob = job;
            break;
        }
    }
    
    //Updating status based on whether a job was found or not
    if (currentJob==null) {
        //Blocking the printer from running multiple cronJobs at once and taking all the print jobs
        var newPrinterCondition = {"printerCondition":"free"};
        console.log("No job found.  Reset printer. " + JSON.stringify(newPrinterCondition));
        fs.writeFile(printerCondition,JSON.stringify(newPrinterCondition),function (err) {
             console.error('Error message (null if no errors) in writing printerCondition.json:  ' + err);
        })
    } else {
        console.log("Found a job for the asset. queue id = " + currentJob.id );
        
        var status = {
            "status": "allocated",
            "percentComplete": 10
        };
        ws.sendProgress(location, 10, "Allocated", printer);
        busysleep(1000);
        var changeStatus;
        restOptions['path']='/queue/changeElementStatus/' + currentJob.id;
        restOptions['method'] = 'POST';
        var startPurchaseRequest = http.request(restOptions, function (res) {
            var msg = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                msg += chunk;
            });
            res.on('end', function () {
                console.log("End of startPurchaseRequest");
                changeStatus = msg;
            });
        });
        startPurchaseRequest.write(JSON.stringify(status));
        startPurchaseRequest.end();

        while (changeStatus == null) {
            deasync.sleep(50);
        }
    }
    return currentJob;
}

var productPrice;

module.exports.createOrder = function(selectedJob, magentoOptions, magentoCredentials, magentoHeader, shippingInfo) {
    magentoOptions['path'] = '/market/index.php/rest/V1/integration/customer/token';
    magentoOptions['method'] = 'POST';
    var productName = selectedJob.sku;
    productPrice = selectedJob.price;
    var user = JSON.stringify(JSON.parse(fs.readFileSync(magentoCredentials)));
    var token = null;
    var userTokenRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            token = JSON.parse(msg);
            console.log('Token = ' + token);
        });
    });
    userTokenRequest.write(user);
    userTokenRequest.end();
    while (token == null) {
        deasync.sleep(50);
    }

console.log("get " + JSON.stringify(token));
console.log("creating carts.. ");

    magentoOptions['path'] = '/market/index.php/rest/V1/carts/mine/';
    magentoOptions['method'] = 'POST';
    magentoHeader['Authorization'] = 'Bearer ' + token;
    magentoOptions['headers'] = magentoHeader;
    var cartReturn;
    var createCartRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            cartReturn = msg;
            console.log('cartReturn = ' + cartReturn);
        });
        res.on('error', function (err) {
            //do some thing , error  handling
            console.log(err);
          });
    });
    createCartRequest.end();
    while (cartReturn == null) {
        deasync.sleep(50);
    }

console.log("creating carts Done " + cartReturn);
    var sku = productName;
    var price = productPrice;

    //sku = sku.substring(1, sku.length - 1);
    var productData = {
        'quote_id': cartReturn,
        'sku': sku,
        'qty': 1
    };
    var cartData = {'cartItem': productData};

    console.log('sku: ' + sku);
    console.log('cartData: ' + JSON.stringify(cartData));

    magentoOptions['path'] = '/market/index.php/rest/V1/carts/mine/items';
    magentoOptions['method'] = 'POST';
    var addProductReturn;
    var addProductRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            addProductReturn = msg; //JSON.parse(msg);
            console.log('addProductReturn = ' + addProductReturn);
        });
    });
    addProductRequest.write(JSON.stringify(cartData));
    addProductRequest.end();
    while (addProductReturn == null) {
        deasync.sleep(50);
    }
    var addresses = JSON.parse(fs.readFileSync(shippingInfo));

console.log("set billing address");
    console.log('addresses = ' + JSON.stringify(addresses));
    magentoOptions['path'] = '/market/index.php/rest/V1/carts/mine/billing-address';
    magentoOptions['method'] = 'POST';
    var shippingInfoReturn;
    var shippingInfoRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            shippingInfoReturn = msg; //JSON.parse(msg);
            console.log('Shipping information added' + shippingInfoReturn);
        });
    });
    shippingInfoRequest.write(JSON.stringify(addresses));
    shippingInfoRequest.end();
    while (shippingInfoReturn == null) {
        deasync.sleep(50);
    }
    return cartReturn;
}

module.exports.placeOrder = function(magentoHeader, magentoOptions, restOptions) {
    var payment = {
        'paymentMethod': {
            'method': 'bpcheckout'
        }
    };

    magentoOptions['path'] = '/market/index.php/rest/V1/carts/mine/payment-information';
    magentoOptions['method'] = 'POST';
    var orderID;
    var placeOrderRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            orderID = msg; //JSON.parse(msg);
            console.log('orderID = ' + orderID);
        });
    });
    placeOrderRequest.write(JSON.stringify(payment));
    placeOrderRequest.end();
    while (orderID == null) {
        deasync.sleep(50);
    }

    orderID = orderID.replace(/\"/g, "");

console.log("orderID = " + orderID);
    var invoicePut = {
        'name': 'CheckPasswordMrg.txt',
        'email': 'CheckPasswordMrg.txt',
        'orderid': orderID,
        'price':productPrice
    };

    console.log('invoicePut: ' + JSON.stringify(invoicePut));
    magentoOptions['path'] = '/invoice';
    magentoOptions['method'] = 'POST';
    magentoOptions['port'] = '18322';
    var invoiceAddress;
    var btcDue;
    var bitcoinAddress;
    var bitpayURL;
    var generateBitcoinRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            invoiceAddress = msg;
            var msgJSON = JSON.parse(msg);
            //btcDue = JSON.stringify(msgJSON.address.btcDue);
            //bitcoinAddress = JSON.stringify(msgJSON.address.bitcoinAddress);
            bitpayURL = JSON.stringify(msgJSON.url).replace(/\"/g, "");
            console.log('url: ' + bitpayURL);
            //console.log('bitcoinAddress: ' + bitcoinAddress);
            //console.log('invoiceAddress = ' + invoiceAddress);
        });
    });


    generateBitcoinRequest.write(JSON.stringify(invoicePut));
    generateBitcoinRequest.end();
    while (bitpayURL == null) {
        deasync.sleep(50);
    }

    console.log("create transaction...");
    createtx.set_payment(bitpayURL);

    return orderID;
}

module.exports.downloadProduct = function(restOptions, assetID, currentJob, magentoOptions, orderID, downloadDir) {
    var status = {
        "status": "downloading/purchasing",
        "percentComplete": 20
    };
    ws.sendProgress(location, 20, "Initial check", printer);
    busysleep(1000);
    ws.sendProgress(location, 30, "Downloading", printer);
    busysleep(2000);
    restOptions['path'] = '/queue/changeElementStatus/' + currentJob.id;
    restOptions['method'] = 'POST';
    var changeStatus;
    var downloadStatusRequest = http.request(restOptions, function (res) {
        var msg = '';

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            changeStatus = msg;
            console.log('changeStatus = ' + changeStatus);
        });
    });
    downloadStatusRequest.write(JSON.stringify(status));
    downloadStatusRequest.end();
    magentoOptions['port'] = '18322';

    //var orderPath = parseInt(orderID)+1;
    var orderPath = parseInt(orderID);
    magentoOptions['path'] = '/getcontents?order='+ orderPath;
    var url = "http://" + magentoOptions['host'] + ":" + magentoOptions['port'] + magentoOptions['path'];
    var filename = downloadDir + orderID;
    var file = fs.createWriteStream(filename);
    var responseStatus;
    var fin = false;
    var request = http.get(url, function(response) {
        responseStatus = response.pipe(file);
        response.on('end', function() {
          fin = true;
        });
    });
    process.stdout.write('Start waiting process for downloading ')
    var dcount = 0;
    while (!fin) {
       process.stdout.write('*');
       deasync.sleep(1000);
       ws.sendProgress(location, 30 + dcount * 1, "Downloading", printer);
       dcount = dcount +1;
    }
    process.stdout.write(' done.');
    console.log('');
    console.log('File downloaded: ' + filename);
    file.close();
    return filename;
}

module.exports.verifyProduct = function(restOptions, assetID, currentJob, productFile, receiptDir, printerCondition) {
    var status = {
        "status": "verifying",
        "percentComplete": 50
    }; 
    ws.sendProgress(location, 50, "Verifiying Information", printer);
    busysleep(3000);
    restOptions['method'] = 'POST';
    restOptions['path'] = '/queue/changeElementStatus/' + currentJob.id;
    //restOptions['path'] = '/queue/changeElementStatus/' + currentJob.prioritynum;
    var changeStatus;
    var verifyStatusRequest = http.request(restOptions, function (res) {
        var msg = '';

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            changeStatus = msg;
        });
    });
    verifyStatusRequest.write(JSON.stringify(status));
    verifyStatusRequest.end();
    while (changeStatus == null) {
        deasync.sleep(50);
    }
    console.log('Beging hash of file: ' + productFile);
    var hashResult;
    var fd = fs.createReadStream(productFile);
    var hash = crypto.createHash('sha256');
    hash.setEncoding('hex');
    fd.on('end', function() {
        hash.end();
        hashResult=hash.read();
        console.log('**************** hashResult = ' + hashResult);
    });
    fd.pipe(hash);
    while (hashResult == null) {
        deasync.sleep(50);
    }
    console.log('Beging verifying file...');
    var recieptFile = receiptDir + hashResult + '.prf';
    var verificationResult;
    if (!fs.existsSync(recieptFile)) {
        console.log('Receipt does not exist in certified reciept store.');
        verificationResult = false;
    }
    else
    {
       if (!verify(recieptFile, hashResult)) {
                console.log("Error reading proof or proof can not be verified.");
                verificationResult=false;
       } else {
                console.log("Proof is verified.");
                verificationResult = true;
       }
    } 

    ws.sendProgress(location, 60, "Verifiying Information", printer);
    busysleep(1000);
    while (verificationResult == null) {
        deasync.sleep(50);
    }

    ws.sendProgress(location, 69, "Verified", printer);
    busysleep(1000);

    if (verificationResult) {
        var status = {
            "status": "Verification passed... printing",
            "percentComplete": 70
        };
        ws.sendProgress(location, 70, "Verified. Start printing", printer);
        busysleep(1000);

        for (i = 75; i <= 95; i +=10) {
           ws.sendProgress(location, i, "Printing..", printer);
           busysleep(1000);
        }
        ws.sendProgress(location, 100, "Printed.", printer);
        busysleep(4000);
        ws.sendProgress(location, 0, "Free", printer);
    } else {
        var status = {
            "status": "Verification of downloaded design failed, print job will now be cancelled",
            "percentComplete": 100
        };
        ws.sendProgress(location, 100, "Canceled", printer);
        busysleep(4000);
        ws.sendProgress(location, 0, "Free", printer);
    }
    restOptions['method'] = 'POST';
    restOptions['path'] = '/queue/changeElementStatus/' + currentJob.id;
    //restOptions['path'] = '/queue/changeElementStatus/' + currentJob.prioritynum;
    var changeStatus;
    var verifyResultRequest = http.request(restOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            changeStatus = msg;
        });
    });
    verifyResultRequest.write(JSON.stringify(status));
    verifyResultRequest.end();
    // Unblocking the printer from grabbing new jobs due to print completeing or verification failing and opening up the printer for use
    var newPrinterCondition = {"printerCondition":"free"};
    console.log(JSON.stringify(newPrinterCondition));
    fs.writeFile(printerCondition,JSON.stringify(newPrinterCondition),function (err) {
        console.error('Error (null if no error) from changing printerCondition.json status:' +  err);
    });
}
