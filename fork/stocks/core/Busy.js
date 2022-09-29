
function Busy(checkHandler) {
	var list = [];
	this.register = function(callback) {
		list.push(callback);
		this.inject();
	};
	this.inject = function() {
		if (!checkHandler()) {
			list.forEach((callback, index) => {
				callback();
			});
		}
	};
};

module.exports = Busy;