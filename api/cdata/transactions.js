
const fs = require('fs');

// http://es6-features.org/#GetterSetter
var Transactions = (function() {
	var _id = 0;
	var path = './../cdata/transactions';
	var readInfo = function() {
		var info = JSON.parse(fs.readFileSync(path + '/_info.json', { flag: 'r' }));
		_id = info.id;
	};
	var writeInfo = function() {
		try {
			fs.writeFileSync(path + '/_info.json', JSON.stringify({id: _id}), { flag: 'w' });
		}
		catch (err) {
			console.log(err);
		}
	};
	var Transactions = function() {
		readInfo();
		this.last = function(total) {
			var max = _id;
			var min = Math.max(1, _id - (Number(total - 1) || 100));
			var content = [];
			for (var ii = min; ii <= max; ii++) {
				var file = path + '/' + ii + '.json';
				if (!fs.existsSync(file)) continue;
				try {
					var info = JSON.parse(fs.readFileSync(file, { flag: 'r' }));
				}
				catch(err) {
					console.log(err);
				}
				content.push(info);
			}
			return content;
		};
		this.insert = function(transaction) {
			var nid = _id + 1;
			var result = {id: nid, data: transaction};
			try {
				fs.writeFileSync(path + '/' + nid + '.json', JSON.stringify({id: nid, data: transaction}), { flag: 'w' });
			}
			catch (err) {
				console.log(err);
				return null;
			}
			this.id = _id + 1;
			return result;
		};
	};
	Transactions.prototype = {
		set id(value) {
			_id = value;
			writeInfo();
		},
		get id() {
			return _id;
		},
	};
	return Transactions;
})();

module.exports = new Transactions();