const fs = require('fs');
const util = require('util');
const globals = require("./../globals");
const output = require("./output");

/* var Ob = function(sepparator) {
  var args = [];
  this.add = function() {
    for (var ii in arguments) {
      if (util.isObject(arguments[ii])) {
        arguments[ii] = JSON.stringify(arguments[ii]);
      }
    }
    args = args.concat(Array.prototype.slice.call(arguments).join(sepparator));
  };
  this.flush = function() {
    var res = args.join(sepparator);
    args = [];
    return res;
  };
  this.out = function() {
    output.out.apply(output, args);
    args = [];
  };
}; */

var Logs = function() {

  var logs = '';
  console.log = function() {
    for (var ii in arguments) {
      if (util.isObject(arguments[ii])) {
        arguments[ii] = JSON.stringify(arguments[ii]);
      }
    }
    var args = Array.prototype.slice.call(arguments).join(' ') + '\n';
    logs += args;
    process.stdout.write(args);
  };

  this.out = function() {
    output.out.apply(output, arguments);
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
        args = args.concat(Array.prototype.slice.call(arguments).join(' '));
      },
      flush: function() {
        output.out.apply(output, args);
        args = [];
      },
    };
  })();

  this.stat = (function() {
    return {
      data: {},
      value: function(std, val) {
        var rr = std.split('.');
        var ref = this.data;
        for (var ii = 0; ii < rr.length; ii++) {
          if (ii == rr.length-1) {
            ref[rr[ii]] = val;
          }
          else {
            if (!ref.hasOwnProperty(rr[ii])) {
              ref[rr[ii]] = {};
            }
            ref = ref[rr[ii]];
          }
        }
      },
      init: function(stockNames) {
        this.value('total', 0);
        this.value('diff', 0);
        globals.pairs.currencies.forEach((currency, ii) => {
          this.value(`cashout.${currency}`, 0);
        });
        this.value('feeout', 0);
        this.value('minout', 0);
        stockNames.forEach((iiName, ii) => {
          stockNames.forEach((jjName, jj) => {
            if (jjName != iiName) {
              this.value(`compare.${iiName}.${jjName}`, {'out':0, 'in':0});
            }
          });
        });
      },
      format: function() {
        var ii, jj;
        var content = '';
        content += `total: ${this.data.total}\n\n`;
        content += "compare:\n";
        for(ii in this.data.compare) {
          content += `   ${ii} -> `;
          for(jj in this.data.compare[ii]) {
            content += `\t${jj}: out(${this.data.compare[ii][jj].out}) in(${this.data.compare[ii][jj].in});`;
          }
          content += "\n";
        }
        content += "\n";
        content += `diff: ${this.data.diff}\n\n`;
        content += "cashout:  \n";
        for(ii in this.data.cashout) {
          content += `   ${ii}: ${this.data.cashout[ii]}\n`;
        }
        content += "\n\n";
        content += `feeout:  ${this.data.feeout}\n\n`;
        content += `minout:  ${this.data.minout}\n\n`;
        return content;
      }
    };
  })();

  this.save = function(path, name) {
    // console.info(util.inspect(stat, false, null));
    try {
      fs.writeFileSync(path + name + '.txt', this.stat.format() + "------------------------------\n\n" + logs, { flag: 'w' });
    }
    catch (err) {
      console.log(err);
      return null;
    }
  };
};

module.exports = Logs;