const hierarchy = require('./hierarchy-single');
const find_first = require('./find-first');

module.exports = (renderer, context, config) => {
	let templates = hierarchy(context.post, config.templateExt);
	let template = find_first(templates, config.templateDir);
	if (template) {
		return renderer.render(template, context);
	} else {
		throw new Error('Could not find a matching template');
	}
};
