// const isPlainObject = require('is-plain-object');
const util = require('util');

var ObjUtil = {
	isEmpty: function(obj) {
  	return Object.keys(obj).length === 0;
	},
	find: function(obj, route) {
		if (obj == null) return obj;
		var rr = route.split('.');
		var ref = obj;
		for (var ii in rr) {
			ii = Number(ii);
			if (ref.hasOwnProperty(rr[ii])) {
				if (ii + 1 == rr.length) return ref[rr[ii]];
				else {
					ref = ref[rr[ii]];
				}
			}
			else return null;
		}
	},
	toJSON: function(obj, fnc) {
		var data;
		if (util.isArray(obj)) data = [];
		else if (util.isObject(obj)) data = {};
		else return;
		for (var item in obj) {
			if (util.isFunction(obj[item])) {
				if (fnc) data[item] = obj[item]();
				continue;
			}
			if (util.isObject(obj[item]) || util.isArray(obj[item])) {
				data[item] = ObjUtil.toJSON(obj[item], fnc);
			}
			else data[item] = obj[item];
		};
		return data;
	}
};

module.exports = ObjUtil;