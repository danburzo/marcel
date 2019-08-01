const { promisify } = require('util');
const { existsSync } = require('fs-extra');
const { join } = require('path');
const nunjucks = require('nunjucks');

const __tcache__ = new Map();

const first_found = (templates, dir) =>
	templates.find(t => {
		if (__tcache__.has(t)) {
			return __tcache__.get(t);
		}
		let found = existsSync(join(dir, t));
		__tcache__.set(t, found);
		return found;
	});

class NunjucksRenderer {
	constructor(config) {
		this.config = config;
		this.env = nunjucks.configure(config.templateDir, {
			autoescape: false
		});
	}

	async render(templates, context, fallback) {
		templates = templates.map(t => `${t}.${this.config.templateExt}`);
		let template = first_found(templates, this.config.templateDir);
		if (template) {
			return promisify(this.env.render.bind(this.env))(template, context);
		} else if (fallback) {
			return promisify(this.env.renderString.bind(this.env))(
				fallback,
				context
			);
		}
	}

	add_filter(name, func) {
		this.env.addFilter(
			name,
			async function() {
				let args = Array.from(arguments);
				let callback = args.pop();
				try {
					callback(null, await func(...args));
				} catch (err) {
					callback(err);
				}
			},
			true // async
		);
	}
}

module.exports = NunjucksRenderer;
