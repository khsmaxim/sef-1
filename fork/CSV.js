const fs = require('fs');
const util = require('util');
const globals = require("./../globals");
const output = require("./output");

var CSV = function() {

  var logs = '';

  this.get = function() {
    return logs;
  };

  this.out = function() {
    var args = Array.prototype.slice.call(arguments).join(',');
    logs += args + "\n";
  };

  this.ob = (function() {
    var args = [];
    return {
      add: function() {
        for (var ii in arguments) {
          if (util.isObject(arguments[ii])) {
            arguments[ii] = JSON.stringify(arguments[ii]);
          }
        }
        args = args.concat(Array.prototype.slice.call(arguments).join(','));
      },
      flush: function() {
        logs += args.join(',') + "\n";
        args = [];
      },
    };
  })();

  this.save = function(path, name) {
    // console.info(util.inspect(stat, false, null));
    try {
      fs.writeFileSync(path + name + '.csv', logs, { flag: 'w' });
    }
    catch (err) {
      console.log(err);
      return null;
    }
  };
};

module.exports = CSV;