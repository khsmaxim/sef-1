const isPlainObject = require('is-plain-object');
const util = require('util');

module.exports = {
	handle: function(callback, name) { // , ...args
		if (!callback) return null;
		var args = [];
		for (var ii = 2; ii < arguments.length; ii++) {
			args.push(arguments[ii]);
		}
		if (util.isArray(callback)) {
			for (var ii in callback) {
				if (isPlainObject(callback[ii])) {
					if (callback[ii].hasOwnProperty(name) && util.isFunction(callback[ii][name])) {
						// callback[ii][name](...args);
						callback[ii][name].apply(this, args);
					}
				}
			}
		}
		else if (isPlainObject(callback)) {
			if (callback.hasOwnProperty(name) && util.isFunction(callback[name])) {
				// callback[name](...args);
				callback[name].apply(this, args);
			}
		}
		return null;
	},
};