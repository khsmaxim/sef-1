
/*

Compare
	[A]		B:{in:0, out:0}		C:{in:0, out:0}		...
	[B]		A:{in:0, out:0}		C:{in:0, out:0}		...
	[C]		A:{in:0, out:0}		B:{in:0, out:0}		...
	...
diffIn
	A: (sell)
		B: (buy)
			enought A to SELL {in:0, out:0}
			enought B to BUY	{in:0, out:0}
			right FEE {in:0, out:0}
			greater than min {in:0, out:0}
		C: (buy)
			enought A to SELL {in:0, out:0}
			enought C to BUY	{in:0, out:0}
			right FEE {in:0, out:0}
			greater than min {in:0, out:0}
	B: (sell)
		A: (buy) ...
		C: (buy) ...
	C: (sell)
		A: (buy) ...
		B: (buy) ...

-----------------------

 compare:
	 {
		A:
			{ B: { in: 0, out: 0 },
				C: { in: 0, out: 0 },
				D: { in: 0, out: 0 } },
		 B: ...
		 ...
	find:
	 {
		A: (sell)
			{ B: (buy)
					{
						diff: 0, // when diff in
						allow: { // is sell A and buy B not locked
							sell: { in: 0, out: 0 },
							buy: { in: 0, out: 0 }
						},
						enought: {
							sell: { in: 0, out: 0, nocahe: 0 },
							buy: { in: 0, out: 0, nocahe: 0 }
						},
						fee: { in: 0, out: 0 },
						min: { in: 0, out: 0 }
					},
				C: ...
				...
			},
		B: ...
		...
	 }

*/


var Stat = function(stockNames) {
	data = {};
	var $value = function(std, val) {
		var rr = std.split('.');
		var ref = data;
		for (var ii = 0; ii < rr.length; ii++) {
			if (ii == rr.length-1) {
				ref[rr[ii]] = val;
			}
			else {
				if (!ref.hasOwnProperty(rr[ii])) {
					ref[rr[ii]] = {};
				}
				ref = ref[rr[ii]];
			}
		}
	};
	// var stockNames = ['A', 'B', 'C', 'D'];
	stockNames.forEach((iiName, ii) => {
		stockNames.forEach((jjName, jj) => {
			if (jjName != iiName) {
				$value(`compare.${iiName}.${jjName}`, {'out':0, 'in':0});
				$value(`find.${iiName}.${jjName}.diff`, 0);
				$value(`find.${iiName}.${jjName}.allow.sell`, {'out':0, 'in':0});
				$value(`find.${iiName}.${jjName}.allow.buy`, {'out':0, 'in':0});
				$value(`find.${iiName}.${jjName}.enought.sell`, {'out':0, 'in':0}); // , 'nocahe':0
				$value(`find.${iiName}.${jjName}.enought.buy`, {'out':0, 'in':0}); // , 'nocahe':0
				$value(`find.${iiName}.${jjName}.fee`, {'out':0, 'in':0});
				$value(`find.${iiName}.${jjName}.min`, {'out':0, 'in':0});
			}
		});
	});
	return data;
};

module.exports = Stat;