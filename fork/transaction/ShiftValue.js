
// BTC, 1.74, 1
module.exports = function(currency, before, after) {
	this.currency = currency;
	this.shift = {
		before: before || 0,
		after: after || 0,
		get diff() {
			return this.after - this.before;
		}
	};
};