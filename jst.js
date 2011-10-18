(function() {
    var global = (function() { return this; })();

    var oldJst = global.jst;
    var jst = global.jst = function(tplNode, data) {
        return cleanSpans(jstApply(tplNode, data, null), true);
    };

    jst.noConflict = function() {
        if (oldJst !== undefined) global.jst = oldJst; else delete(global.jst);
        return jst;
    };

    var ATTR_PREFIX = jst.attrPrefix = "data-jst-";
    var CLEAN_TAG = jst.cleanTag = "SPAN";

    var htmlSafe = function(s) {
        if (s === null) return "";
        return s.toString().replace(/&/g, "&amp;")
            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    };

    var isArray = function(a) {
        if (Array.isArray) return Array.isArray(a);
        return (Object.prototype.toString.call(a) == '[object Array]');
    };

    var nextSiblingElement = function(node) {
        do { node = node.nextSibling; } while (node && node.nodeType != 1);
        return node;
    };

    var cleanSpans = function(node, saveMe) {
        if (node.nodeType != 1) return node;

        var c = node.firstChild, next, parent = node.parentNode;
        while (c) {
            next = c.nextSibling;
            cleanSpans(c, false);
            c = next;
        }
        if (!saveMe && node.nodeName == CLEAN_TAG && !node.hasAttributes()) {
            c = node.firstChild;
            while (c) {
                parent.insertBefore(c, node);
                c = node.firstChild;
            }
            parent.removeChild(node);
        }
        if (saveMe) node.normalize();
        return node;
    };

    /**
     * selector:
     * a.b.c.d
     * ''           // self
     * href:a.b.c   // атрибут, возаращает ['href', val]
     * #loop.counter     // выборка не из data, а из контекста
     * href:#loop.counter - тоже можно
     */

    var resolvePath = function(path, value, ctx) {
        if (path.charAt(0) == "#") {
            path = path.substr(1);
            value = ctx;
        }
        if (path == "") return value;
        var parts = path.split(".");
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (value && value[p]) value = value[p]; else value = null;
        }
        return value;
    };

    var select = function(selector, value, ctx) {
        var attr = null;
        var m = selector.match(/^([a-z0-9_-]+)\s*:\s*/);
        if (m) { attr = m[1]; selector = selector.substr(m[0].length); }
        var val = resolvePath(selector, value, ctx);
        return attr ? [attr, val] : val;
    };

    jst.methods = {};


    jst.methods["text"] = function(value) { this.innerHTML = htmlSafe(value); };
    jst.methods["html"] = function(value) { this.innerHTML = value; };
    jst.methods["attr"] = function(value) {
        if (isArray(value) && value.length == 2) {
            this.setAttribute(value[0], value[1]);
        }
    };
    jst.methods["if"] = function(value) {
        if (this.parentNode && !value) this.parentNode.removeChild(this);
    };
    jst.methods["if-not"] = function(value) {
        if (this.parentNode && value) this.parentNode.removeChild(this);
    };
    jst.methods["foreach"] = function(value) {
        var parent = this.parentNode;
        var divider = nextSiblingElement(this);
        if (divider && divider.hasAttribute(ATTR_PREFIX + "divider")) {
            divider.parentNode.removeChild(divider);
        } else {
            divider = null;
        }
        var next = this.nextSibling;
        this.parentNode.removeChild(this);
        if (isArray(value)) {
            var ctx = { "counter": 1, "odd": false, "count": value.length };
            for (var j = 0; j < value.length; j++) {
                ctx.counter = j + 1;
                ctx.odd = (ctx.counter % 2 == 1);
                if (j > 0 && divider) jstApply(parent.insertBefore(divider.cloneNode(true), next), value[j], ctx);
                jstApply(parent.insertBefore(this.cloneNode(true), next), value[j], ctx);
            }
        }
    };

    var jstApply = function(node, data, ctx) {
        var rules = [], i;
        for (i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            if (attr.name.indexOf(ATTR_PREFIX) == 0) {
                rules.push({
                    "method":   attr.name.substr(ATTR_PREFIX.length),
                    "selector": attr.value
                });
            }
        }

        for (i = 0; i < rules.length; i++) {
            var rule = rules[i];
            node.removeAttribute(ATTR_PREFIX + rule.method);

            if (jst.methods.hasOwnProperty(rule.method)) {
                jst.methods[rule.method].call(node, select(rule.selector, data, ctx));
            }
        }

        var ch = node.firstChild, children = [];
        while (ch) {
            children.push(ch);
            ch = ch.nextSibling;
        }
        for (i = 0; i < children.length; i++) {
            ch = children[i];
            if (ch.nodeType == 1) jstApply(ch, data, ctx);
        }

        return node;
    };

})();
