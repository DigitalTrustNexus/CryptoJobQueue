var chainpointvalidate = require('chainpoint-client')
var crypto = require('crypto');
var fs = require("fs");
var http = require('http');
var deasync = require('deasync');
var magentoServerURL = process.env.magentoServer;
var magentoServerPort = process.env.magentoPort;

module.exports.completeOrder = function(magentoHeader, magentoOptions, magentoAdminCredentials, orderID, restOptions) {
   magentoOptions['host'] = magentoServerURL;
   magentoOptions['port'] = magentoServerPort;

/*
 * get admin token
 */
console.log("get admin token..." + orderID);
    magentoOptions['path'] = '/market/index.php/rest/V1/integration/admin/token';
    magentoOptions['method'] = 'POST';

    var user = JSON.stringify(JSON.parse(fs.readFileSync(magentoAdminCredentials)));
    var admintoken = null;
    var adminTokenRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            admintoken = JSON.parse(msg);
            console.log('AdminToken = ' + admintoken);
        });
    });
    adminTokenRequest.write(user);
    adminTokenRequest.end();
    while (admintoken == null) {
        deasync.sleep(50);
    }

console.log("change order status...");
/*
 * change order status
 */
    magentoOptions['path'] = '/market/index.php/rest/V1/order/' + orderID + '/invoice';
    magentoOptions['method'] = 'POST';
    magentoHeader['Authorization'] = 'Bearer ' + admintoken;
    magentoOptions['headers'] = magentoHeader;
    params = {"statusHistory":{"comment":"test", "status":"Complete"}}
    var result;
    var orderCompleteRequest = http.request(magentoOptions, function (res) {
        var msg = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            msg += chunk;
        });
        res.on('end', function () {
            result = JSON.parse(msg);
            console.log('Result = ' + result);
        });
    });
    orderCompleteRequest.write(user);
    orderCompleteRequest.end();
    while (result == null) {
        deasync.sleep(50);
    }

    return;
}
