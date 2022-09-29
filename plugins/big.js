const Big = require('big.js');

Big.max = function () {
  var i, y,
    x = new this(arguments[0]);
  for (i = 1; i < arguments.length; i++) {
    y = new this(arguments[i]);
    if (x.lt(y)) x = y;
  }
  return x;
};

Big.min = function () {
  var i, y,
    x = new this(arguments[0]);
  for (i = 1; i < arguments.length; i++) {
    y = new this(arguments[i]);
    if (x.gt(y)) x = y;
  }
  return x;
};

module.exports = Big;