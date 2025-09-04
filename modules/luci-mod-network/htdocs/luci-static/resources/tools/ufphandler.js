'use strict';
'require rpc';
'require fs';
'require baseclass';


var UfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
	expect: { '': {} }
});

return baseclass.extend({

	checkUfpInstalled() {
		return L.resolveDefault(fs.stat('/usr/sbin/ufpd'), null);
	},

	callUfpList() {
		var has_ufp = this.checkUfpInstalled();

		if (has_ufp)
			return UfpList();
		else
			return Promise.resolve(null);
	}

});
