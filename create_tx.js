const bitcoin = require('bitcoinjs-lib')
const TestNet = bitcoin.networks.testnet
const JsonPaymentProtocol = require('json-payment-protocol')
const paymentProtocol = new JsonPaymentProtocol();
const fetch = require('node-fetch');
var request = require('request');
var crypto = require("crypto");
var eccrypto = require("eccrypto");
var signature;
var publicKey;
var privKey;
var from = "CheckPasswordMrg.txt";
var wif = 'CheckPasswordMrg.txt';

async function fetchAsync (url) {
  const response = await fetch(url);
  return await response.json();
}

/*
 * set buyer's currency  to BTC
 */
async function setBuyerCurrency(url) {
  let token =  url.substr(url.lastIndexOf('/') +1);
  console.log("token = " + token);
  const body = JSON.parse('{"buyerSelectedTransactionCurrency": "BTC", "invoiceId": "' + token + '"}');
  console.log("token = " + body);
  const data = fetch('https://test.bitpay.com/invoiceData/setBuyerSelectedTransactionCurrency', {
      method: 'post',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
  })
  .then(res => res.json())
  .then(json => console.log(json));

  console.log("fetch finish");

  return await data;
}

/*
 * get paymentrequest from the URL
 */
async function getPaymentRequest(url) {
  let response = await paymentProtocol.getRawPaymentRequestAsync(url);
  try {
     let paymentRequest = await paymentProtocol.parsePaymentRequestAsync(response.rawBody, response.headers);
     return await paymentRequest;
  } catch (e){
     console.log(e);   // uncaught
  }
}

/*
 * create signature for bitcoin transaction
 */
async function create_sig(tosign) {
   //console.log("tosign " + tosign);
   var privatekey = Buffer.from(privKey, 'hex')
   var publickey = eccrypto.getPublic(privatekey);
   var buf = Buffer.from(tosign, 'hex')
   var msg = crypto.createHash("sha256").update(buf).digest();
   let sig0;
   sig0 = await eccrypto.sign(privatekey, buf).then(function(sig) {
      eccrypto.verify(publicKey, buf, sig).then(function() {
          signature = sig.toString('hex');
          return sig.toString('hex');
      }).catch(function() {
         console.log("Signature is BAD");
         return "";
      });
      return sig0;
   });
}

/*
 * create bitcoin transaction
 */
async function make_payment(amount, outaddress) {
   request.post(
   {
      url: 'https://api.blockcypher.com/v1/btc/test3/txs/new',
      body: JSON.stringify({ inputs: [{ addresses: [ from ] }],
      // convert amount from BTC to Satoshis 
      outputs: [{ addresses: [ outaddress ], value: amount}] }),
   },
   async function (err, res, body) {
      //console.log(body);
      let tmptx = JSON.parse(body);

      tmptx.pubkeys = [];
      // build signer from WIF 
      var keyPair = bitcoin.ECPair.fromWIF(wif, TestNet)
      publicKey = keyPair.publicKey
      privKey = keyPair.privateKey

      // iterate and sign each transaction and add it in signatures while store corresponding public key in pubkeys 
      tmptx.signatures = tmptx.tosign.map(function (tosign, n) {
         tmptx.pubkeys.push(publicKey.toString('hex'));
         return create_sig(tosign);
      });

      setTimeout(later, 200);

      function later() {
        tmptx.signatures = [signature];
        console.log(JSON.stringify(tmptx));
        request.post({
           url: 'https://api.blockcypher.com/v1/btc/test3/txs/send',
           body: JSON.stringify(tmptx),
        },
        function (err, res, body) {
          if (err) {
             //console.log("rejected");
             reject(err);
          } else {
             console.log("OK");
             //console.log(body);
          }
        });
      }
   });
}

module.exports = {
  set_payment: async function(url) {
    console.log("setting payment..");

    console.log("1.. " + url);
    await setBuyerCurrency(url);
    console.log("2.. ");
    var req =  await getPaymentRequest(url);
    var amount = req.outputs[0].amount;
    var outaddress = req.outputs[0].address;
    console.log("3.. ");
    console.log(outaddress);
    make_payment(amount, outaddress);

    /* debug
    console.log(req);
    console.log(amount);
    console.log(outaddress);
    */
    console.log("finish ");
  }
}
