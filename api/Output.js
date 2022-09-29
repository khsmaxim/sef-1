const moment = require('moment');

var Output = function() {
  var prefix = function() {
    return '[API]['+moment().format('MM/DD HH:mm:ss')+']';
  };
	this.message = function(message) {
		return prefix() + ' ' + message;
	};
	this.log = function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(prefix());
		console.log.apply(console, args);
	}
};

module.exports = Output;
