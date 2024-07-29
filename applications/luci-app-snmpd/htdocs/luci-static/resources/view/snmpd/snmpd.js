// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
"use strict";
"require form";
"require uci";
"require fs";
"require rpc";
"require ui";
"require view";

return L.view.extend({
	load: function() {
		return Promise.all([
			uci.load(["snmpd", "luci_snmpd"]).then(function() {
				var mibFile = uci.get("luci_snmpd", "snmpd", "download_mib");
				if (mibFile)
					return L.resolveDefault(fs.stat(mibFile), null);
				else
					return Promise.resolve(null);
			}),
		]);
	},

	__init__: function() {
		this.super('__init__', arguments);

		this.ip_protocol = null;
		this.snmp_version = null;
	},

	render: function(data) {
		var m, s, o, g, go;

		var mibStat = data[0];

		m = new form.Map("snmpd",
			_("SNMP Settings"),
			_("On this page you may configure SNMP settings"));

		s = m.section(form.TypedSection, "snmpd");
		s.anonymous = true;
		s.addremove = false;

		s.tab("general", _("SNMP - General"));

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "system", null,
			_("Here you can configure system settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		if (mibStat) {
			go = g.option(form.Button, '__download', _('MIB download') );
			go.inputtitle = _('Download (%1024.2mB)', 'Download data (action)').format(mibStat.size);
			go.inputstyle = 'action';
			go.onclick = ui.createHandlerFn(this, function(ev) {
				return fs.read(mibStat.path).then(function(data) {
					var url = URL.createObjectURL(new Blob([data], {
						type: 'text/plain'}));

					var link = document.createElement('a');
					link.href = url;
					link.download = mibStat.path.replace(/^.*[\\\/]/, '');
					link.click();
					return Promise.resolve();
				});
			});
		}

		go = g.option(form.Value, "sysLocation", "sysLocation");
		go = g.option(form.Value, "sysContact", "sysContact");
		go = g.option(form.Value, "sysName", "sysName");

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "snmpd", null,
			_("Here you can configure agent settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Flag, "enabled", _("Enable SNMP"),
			_("Enable to use SNMP"));
		go.default = "0";
		go.rmempty = false;

		this.ip_protocol = g.option(form.ListValue, 'ip_protocol', _('IP version'));
		this.ip_protocol.value('ipv4', _('Only IPv4'));
		this.ip_protocol.value('ipv6', _('Only IPv6'));
		this.ip_protocol.value('ipv4/ipv6', _('IPv4 and IPv6'));
		this.ip_protocol.optional = false;
		this.ip_protocol.forcewrite = true;
		this.ip_protocol.default = "IPv4";
		this.ip_protocol.rmempty = false;

		this.ip_protocol.cfgvalue = function(section_id) {
			var ip_protocol = uci.get('snmpd', section_id, 'ip_protocol');

			if (!ip_protocol) {
				var s = uci.get_first('snmpd', 'agent');
				if (!s)
					return null;

				var addr = uci.get('snmpd', s['.name'], 'agentaddress');
				var p = [];

				if (!addr)
					return null;

				addr = addr.toUpperCase();

				if (addr.match(/UDP:\d+/g))
					p.push('ipv4');

				if (addr.match(/UDP6:\d+/g))
					p.push('ipv6');

				ip_protocol = p.join('/');
			}

			return ip_protocol;
		};

		go = g.option(form.Value, "agentaddress", _("The address the agent should listen on"),
			_("Eg: UDP:161, or UDP:10.5.4.3:161 to only listen on a given interface"));

		this.snmp_version = g.option(form.ListValue, 'snmp_version',
			_('SNMP version'),
			_('SNMP version used to monitor and control the device'));
		this.snmp_version.default = 'v1/v2c';
		this.snmp_version.rmempty = false;
		this.snmp_version.forcewrite = true;
		this.snmp_version.value('v1/v2c', _('SNMPv1 and SNMPv2c'));
		this.snmp_version.value('v1/v2c/v3', _('SNMPv1, SNMPv2c and SNMPv3'));
		this.snmp_version.value('v3', _('Only SNMPv3'));

		go = g.option(form.Value,  "agentxsocket", _("The address the agent should allow AgentX connections to"),
			_("This is only necessary if you have subagents using the agentX "
			+ "socket protocol. Eg: /var/run/agentx.sock"));

		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "com2sec", null,
			_("Here you can configure com2sec options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "secname", "secname");
		go = g.option(form.Value, "source", "source");
		go = g.option(form.Value, "community", "community");

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "group", null,
			_("Here you can configure group options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", "group");
		go = g.option(form.Value, "version", "version");
		go = g.option(form.Value, "secname", "secname");

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "access", null,
			_("Here you can configure access options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", "group");
		go = g.option(form.Value, "context", "context");
		go = g.option(form.Value, "version", "version");
		go = g.option(form.Value, "level", "level");
		go = g.option(form.Value, "prefix", "prefix");
		go = g.option(form.Value, "read", "read");
		go = g.option(form.Value, "write", "write");
		go = g.option(form.Value, "notify", "notify");

		s.tab("v2/v2c", _("SNMPv1/SNMPv2c"));

		s.tab("v3", _("SNMPv3"));

		s.tab("traps", _("Traps", "SNMP"));

		return m.render();
	}
});
