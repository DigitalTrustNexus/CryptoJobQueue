/*
    Script for running the additive asset cron job every 30 seconds
*/

//Adding the required javascript modules
var cron = require('node-cron');
var fs = require('fs');
var job = require('./job.js');
var admin = require("./admin.js");

//Setting parameters from the environment
var assetID = process.env.assetID;
var restServerURL = process.env.restServer;
var restServerPort = process.env.restPort;
var magentoServerURL = process.env.magentoServer;
var magentoServerPort = process.env.magentoPort;
var bitCoinToUSD = 1 / process.env.bcUSD;
var printerConditionFile = "./printerCondition.json";
var magentoCredentials = "./magentoCredentials.json";
var magentoAdminCredentials = "./magentoAdminCredentials.json";
var shippingInfo = "./shippingInfo.json";
var downloadDir = "./download/";
var recieptDir = "./certificates/";

// Configuration for the printer
/*
var location ="DDG-96";
var dimension1 = 6;
var dimension2 = 6.5;
var dimension3 = 3.3;
*/
var location = process.env.location;
var dimension1 = process.env.dimension1;
var dimension2 = process.env.dimension2;
var dimension3 = process.env.dimension3;

//Request options and headers for rest server
var restOptions = new Object();
var restHeader = new Object();
restHeader['Content-Type'] = 'application/json';
restOptions['host'] = restServerURL;
restOptions['port'] = restServerPort;
restOptions['headers'] = restHeader;

//Request options and headers for magento server
var magentoOptions = new Object();
var magentoHeader = new Object();
magentoHeader['Content-Type'] = 'application/json';
magentoOptions['host'] = magentoServerURL;
magentoOptions['port'] = magentoServerPort;
magentoOptions['headers'] = magentoHeader;

job.initWS();

console.log('Running cron job every 10 seconds');
cron.schedule('*/10 * * * * *', function () {
    var printerCondition = JSON.parse(fs.readFileSync(printerConditionFile)).printerCondition;
    console.log('Printer Condition: ' + printerCondition)

    //Begining process of finding a job from the queue if the printer is available
    if (printerCondition=='free') {
        console.log('Finding available jobs for available asset.');
        //Blocking the printer from running multiple cronJobs at once and taking all the print jobs
        var newPrinterCondition = {"printerCondition":"busy"};
        console.log(JSON.stringify(newPrinterCondition));
        fs.writeFile(printerConditionFile,JSON.stringify(newPrinterCondition),function (err) {
             console.error('Error message (null if no errors) in writing printerCondition.json:  ' + err);
        });
        //Calling the functions written to follow the steps of finding and completing a job from the queue
        var availableJobs = job.availableQueueJobs(restOptions,location, dimension1, dimension2, dimension3);
        //Selecting job if jobs are available
        if (availableJobs != null){
            console.log('Selecting a job from the available jobs.')
            var selectedJob = job.selectJob(availableJobs, restOptions, assetID, bitCoinToUSD, printerConditionFile);
            console.log('Selecting a job from the available jobs. result ' + selectedJob)
            if (selectedJob != null) {
			    /*
                  // we don't need to issue order as it will be done by from the browser 

                  console.log('Asset creating and paying for order from Marketplace for needed file for selected job.')
                  var cartReturn = job.createOrder(selectedJob, magentoOptions, magentoCredentials, magentoHeader, shippingInfo);
                  var orderID = job.placeOrder(cartReturn,magentoOptions,restOptions);
                  admin.completeOrder(magentoHeader,magentoOptions,magentoAdminCredentials,orderID,restOptions);
                */

                var orderID = selectedJob.ordernumber;
                console.log('Asset downloading purchased file.')
                var productFile = job.downloadProduct(restOptions, assetID, selectedJob, magentoOptions, orderID, downloadDir);
                console.log('Asset verifying downloaded file against the blockchain.')
                job.verifyProduct(restOptions, assetID, selectedJob, productFile, recieptDir, printerConditionFile);
            }
        }
        //job.oneTransaction();
    }
});
