var loki = require('lokijs');
var emitter = require('events').EventEmitter;
var util = require('util');

var Wallet = function () {
	var that = this;
	this.collection = {};
	this.db = new loki('db/wallet.json', {
		autoload: true,
		autosave: true,
		autoloadCallback : function() {
			that.collection.locked = that.db.getCollection('locked');
			if (that.collection.locked === null) {
				that.collection.locked = that.db.addCollection('locked');
			}
			that.emit('loaded');
		}});
	return this;
};
util.inherits(Wallet, emitter);

module.exports = new Wallet();