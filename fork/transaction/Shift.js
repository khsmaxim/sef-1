
// new ShiftValue(_BTC_, 1.74, 1), new ShiftValue(_USD_, 10000, 0)
module.exports = function(from, to) {
	this[from.currency] = from.shift;
	this[to.currency] = to.shift;
};