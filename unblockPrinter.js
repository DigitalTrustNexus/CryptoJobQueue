var fs = require("fs");

var newPrinterCondition = {"printerCondition":"free"};
console.log(JSON.stringify(newPrinterCondition));
fs.writeFile("./printerCondition.json",JSON.stringify(newPrinterCondition),function (err) {
         console.error(err);
});