const moment = require('moment');

module.exports = new (function() {

  var prefix = function() {
    return '['+process.pair+']['+moment().format('MM/DD HH:mm:ss')+']';
  };

  this.message = function(message) {
    return prefix() + ' ' + message;
  };

  this.out = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(prefix());
    console.log.apply(console, args);
  };

  var onceStack = [];
  this.once = function(key, message) {
    if (onceStack.indexOf(key) == -1) {
      onceStack.push(key);
      this.out(key, message);
    }
  };
})();
