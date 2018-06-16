// Libs
const remark = require('remark');
const frontmatter = require('remark-frontmatter');
const parse_yaml = require('remark-parse-yaml');
const html = require('remark-html');
const visit = require('unist-util-visit');

// Modules
const Post = require('../models/post');

const processor = remark()
	.use(frontmatter)
	.use(parse_yaml)
	.use(html);

module.exports = async file => {
	let tree = await processor.run(processor.parse(file));
	let data = {};
	visit(tree, 'yaml', item => {
		data = { ...data, ...item.data.parsedValue };
	});
	let content = await processor.stringify(tree);
	return new Post({ content, data, path: file.path });
};
