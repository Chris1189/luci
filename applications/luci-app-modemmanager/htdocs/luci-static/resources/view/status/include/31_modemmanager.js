'use strict';
'require baseclass';
'require ui';
'require rpc';
'require poll';

var callModems = rpc.declare({
	object: 'network.modemmanager.modem',
	method: 'dump',
	expect: { 'modem': [] }
});

function progressbar(signal) {
	var title = String.format('%d%%', signal);
	var width = String.format('width:%.2f%%', signal);

	return E('div', { 'class': 'cbi-progressbar', 'title': title }, [
			E('div', { 'style': width })
	]);
}

return baseclass.extend({
	title: '',

	load: function() {
		return Promise.all([
			callModems()
		]);
	},

	render: function(result) {
		if (!result[0])
			return null;

		var modems = result[0];
		var info = E([]);

		for (var modem in modems) {

			var name = modems[modem].name;
			var signal = modems[modem].signal;
			var operator = modems[modem].operator;
			var technology = modems[modem].technology_generation.name;

			var beam = progressbar(signal);

			info.append(E('h3', '%s (%s)'.format(_('Mobile Network'), name)));

			var table = E('table', { 'class': 'table' });

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [
					_('Operator')
				]),
				E('td', { 'class': 'td' }, [ operator ])
			]));

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [
					_('Signal Quality')
				]),
				E('td', { 'class': 'td' }, [ beam ])
			]));

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [
					_('Technology Generation')
				]),
				E('td', { 'class': 'td' }, [ technology ])
			]));

			info.append(table)
		}
		return info;
	}
});
