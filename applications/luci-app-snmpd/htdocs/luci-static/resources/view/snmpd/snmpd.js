// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
"use strict";
"require form";
"require ui";
"require view";

return L.view.extend({
	render: function() {
		var m, s, o, g, go;

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

		go = g.option(form.Value, "agentaddress", _("The address the agent should listen on"),
			_("Eg: UDP:161, or UDP:10.5.4.3:161 to only listen on a given interface"));
		

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
