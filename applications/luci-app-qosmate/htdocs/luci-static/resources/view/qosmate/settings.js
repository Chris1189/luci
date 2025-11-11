'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require rpc';
'require fs';
'require poll';
'require tools.widgets as widgets';

// Check if Software Flow Offloading is enabled  
function isSfoEnabled() {
	return uci.get('firewall', '@defaults[0]', 'flow_offloading') === '1';
}

return view.extend({
	handleSaveApply: function(ev) {
		return this.handleSave(ev)
			.then(() => ui.changes.apply())
			.then(() => uci.load('qosmate'))
			.then(() => uci.get_first('qosmate', 'global', 'enabled'))
			.then(enabled => {
				if (enabled === '0') {
					return fs.exec_direct('/etc/init.d/qosmate', ['stop']);
				} else {
					return fs.exec_direct('/etc/init.d/qosmate', ['restart']);
				}
			})
			.then(() => {
				ui.hideModal();
				window.location.reload();
			})
			.catch(err => {
				ui.hideModal();
				ui.addNotification(null, E('p', _('Failed to save settings or update QoSmate service: ') + err.message));
			});
	},

	load: function() {
		return Promise.all([
			uci.load('qosmate'),
			uci.load('firewall'),
		]).catch(error => {
			console.error('Error in load function:', error);
			ui.addNotification(null, E('p', _('Error loading initial data: %s').format(error.message || error)), 'error');
			return [null, null];
		});
	},

	render: function() {
		var m, s_info, s_status, o;

		m = new form.Map('qosmate');

		let s_basic = m.section(form.NamedSection, 'settings', 'settings', _('Basic Settings'));
		s_basic.anonymous = true;
		
		function createOption(name, title, description, placeholder, datatype) {
			var opt = s_basic.option(form.Value, name, title, description);
			opt.datatype = datatype || 'string';
			opt.rmempty = true;
			opt.placeholder = placeholder;
			
			if (datatype === 'uinteger') {
				opt.validate = function(section_id, value) {
					if (value === '' || value === null) return true;
					if (!/^\d+$/.test(value)) return _('Must be a non-negative integer or empty');
					var intValue = parseInt(value, 10);
					var rootQdisc = this.section.formvalue(section_id, 'ROOT_QDISC');
					if (intValue === 0 && rootQdisc === 'hfsc') {
						return _('Value must be greater than 0 for HFSC');
					}
					return true;
				};
			}
			return opt;
		}
		
		var wanInterface = uci.get('qosmate', 'settings', 'WAN') || '';
		o = s_basic.option(widgets.DeviceSelect, 'WAN', _('WAN Interface'), _('Select the WAN interface'));
		o.rmempty = false;
		o.editable = true;
		o.default = wanInterface;

		createOption('DOWNRATE', _('Download Rate (kbps)'), _('Set the download rate in kbps'), _('Default: 90000'), 'uinteger');
		createOption('UPRATE', _('Upload Rate (kbps)'), _('Set the upload rate in kbps'), _('Default: 45000'), 'uinteger');
		
		// Function to get QDisc description based on value
		function getQdiscDescriptionForValue(value) {
			switch(value) {
				case 'hfsc':
					return _('HFSC - Hierarchical Fair Service Curve. Configure realtime traffic settings in the HFSC tab.');
				case 'cake':
					return _('CAKE - Common Applications Kept Enhanced. Configure CAKE-specific parameters in the CAKE tab.');
				case 'hybrid':
					return _('Hybrid - HFSC as shaper, Game Qdisc for realtime traffic, CAKE for default traffic and fq_codel for bulk traffic. Configure realtime class settings in HFSC tab and default class settings in CAKE tab.');
				case 'htb':
					return _('HTB - Hierarchical Token Bucket. Simple 3-tier priority system with pre-configured settings - no additional qdisc configuration required.');
				default:
					return _('Select the root queueing discipline');
			}
		}
		
		// Get description for current value
		function getQdiscDescription() {
			var rootQdisc = uci.get('qosmate', 'settings', 'ROOT_QDISC') || 'hfsc';
			return getQdiscDescriptionForValue(rootQdisc);
		}

		o = s_basic.option(form.ListValue, 'ROOT_QDISC', _('Root Queueing Discipline'), getQdiscDescription());
		o.value('hfsc', _('HFSC'));
		o.value('cake', _('CAKE'));
		o.value('hybrid', _('Hybrid'));
		o.value('htb', _('HTB (Experimental)'));
		o.default = 'hfsc';
		o.onchange = function(ev, section_id, value) {
			// Update description dynamically using shared function
			var newDescription = getQdiscDescriptionForValue(value);
			
			// Find and update the description element
			var node = ev.target.closest('.cbi-value');
			if (node) {
				var descNode = node.querySelector('.cbi-value-description');
				if (descNode) {
					descNode.textContent = newDescription;
				}
			}
			
			// Update dependent fields
			var downrate = this.map.lookupOption('DOWNRATE', section_id)[0];
			var uprate = this.map.lookupOption('UPRATE', section_id)[0];
			if (downrate && uprate) {
				downrate.map.checkDepends();
				uprate.map.checkDepends();
			}
		};

		// Software Flow Offloading Warning
		o = s_basic.option(form.DummyValue, '_sfo_warning', _('Software Flow Offloading Status'));
		o.rawhtml = true;
		o.render = function(section_id) {
			if (isSfoEnabled()) {
				return E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, E('span', { 'style': 'color: orange; font-weight: bold;' }, '⚠')),
					E('div', { 'class': 'cbi-value-field', 'style': 'color: orange;' }, [
						E('strong', {}, _('Software Flow Offloading active - some limitations apply')),
						E('br'),
						_('✓ Static rules work ✗ Dynamic rules may not work')
					])
				]);
			} else {
				return E('div');
			}
		};

		// Warning for bandwidth ratio
		o = s_basic.option(form.DummyValue, '_ratio_warning', _('Bandwidth Ratio Warning'));
		o.rawhtml = true;
		o.render = function(section_id) {
			var downrate = uci.get('qosmate', 'settings', 'DOWNRATE') || '90000';
			var uprate = uci.get('qosmate', 'settings', 'UPRATE') || '45000';
			var bwmaxratio = uci.get('qosmate', 'advanced', 'BWMAXRATIO') || '20';
			
			downrate = parseInt(downrate);
			uprate = parseInt(uprate);
			bwmaxratio = parseInt(bwmaxratio);
			
			if (uprate > 0 && downrate / uprate > bwmaxratio) {
				var ratio = Math.floor(downrate / uprate);
				var upload_mbps = Math.floor(uprate / 1000);
				var limited_download = Math.floor(bwmaxratio * uprate / 1000);
				return E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, E('span', { 'style': 'color: orange; font-weight: bold;' }, '⚠️')),
					E('div', { 'class': 'cbi-value-field', 'style': 'color: orange;' }, [
						E('strong', {}, _('Large download/upload difference detected (') + ratio + ':1 ratio)'),
						E('br'),
						_('Your download speed has been limited to prevent connection issues.'),
						E('br'),
						_('Current limit: ') + limited_download + _(' Mbps (based on your ') + upload_mbps + _(' Mbps upload)') + _('To override: Advanced Settings → BWMAXRATIO'),
					])
				]);
			} else {
				return E('div');
			}
		};
		
		return m.render();
	}
});

function updateQosmate() {
	// Implement the update logic here
	ui.showModal(_('Updating QoSmate'), [
		E('p', { 'class': 'spinning' }, _('Updating QoSmate. Please wait...'))
	]);

	// Simulating an update process
	setTimeout(function() {
		ui.hideModal();
		window.location.reload();
	}, 5000);
}
