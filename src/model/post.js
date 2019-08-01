const { stat, exists, readFile } = require('fs-extra');
const { resolve, sep } = require('path');
const vfile = require('to-vfile');
const slugify = require('@sindresorhus/slugify');

const strip_filename_prefix = require('../util/strip-filename-prefix');

/*
	A map of all content files, useful for
	resolving relative links in markdown files
	to their appropriate permalink.
 */
const __posts__ = new Map();

// Default permalink function
const default_permalink = post => {
	let link = post.slug || post.filename_slug || post.title_slug;
	return post.file.dirname === '.'
		? `/${link}`
		: `/${post.file.dirname}/${link}`;
};

class Post {
	constructor({ perma }) {
		this.__perma__ = perma;
	}

	/*
		Load a file path into a VFile,
		and augment its data with:
		* frontmatter defined in an external file
		* file statistics (creation date, etc.)
	 */
	async load(path, { cwd, frontmatter_path }) {
		__posts__.set(path, this);

		let file = await vfile.read({ path, cwd }, 'utf8');

		// Load frontmatter from external file
		let fm_path = resolve(cwd, frontmatter_path);
		if (await exists(fm_path)) {
			file.data.frontmatter = JSON.parse(await readFile(fm_path, 'utf8'));
		}

		// Load file stats
		let stats = await stat(resolve(file.cwd, file.path));
		file.data.stats = {
			date: new Date(stats.birthtimeMs),
			updated: new Date(stats.mtimeMs)
		};

		this.file = file;
	}

	async parse(parser) {
		if (!this.file) {
			throw new Error('File has not been loaded');
		}
		this.file.__ast__ = await parser(this.file);
	}

	async transform(transformer) {
		if (!this.file.__ast__) {
			throw new Error('File has not been parsed');
		}
		this.file.__ast__ = await transformer(this.file.__ast__, this.file);
	}

	/*
		Property getters
		----------------
	 */

	get stats() {
		return this.file.data.stats;
	}

	get frontmatter() {
		return this.file.data.frontmatter;
	}

	get title() {
		return this.frontmatter.title;
	}

	get excerpt() {
		return this.frontmatter.excerpt;
	}

	get date() {
		return this.frontmatter.date || this.stats.date;
	}

	get updated() {
		return this.frontmatter.updated || this.stats.updated;
	}

	get section() {
		let section = this.file.dirname.split(sep)[0];
		return section === '.' ? '__undefined__' : section;
	}

	get slug() {
		return this.frontmatter.slug;
	}

	get title_slug() {
		if (this.frontmatter.title) {
			return slugify(this.frontmatter.title);
		}
		return undefined;
	}

	get filename_slug() {
		return (
			slugify(strip_filename_prefix(this.file.stem)) ||
			slugify(this.file.stem)
		);
	}

	get permalink() {
		// Explicit permalink in front matter
		if (this.frontmatter.permalink !== undefined) {
			return this.frontmatter.permalink;
		}

		// User-supplied permalink.
		// Allow a result of `false` to be returned (= is draft),
		// only go to default on undefined.
		let custom = this.__perma__ ? this.__perma__(this) : undefined;
		return custom !== undefined ? custom : default_permalink(this);
	}

	get draft() {
		return this.frontmatter.draft;
	}
}

module.exports = Post;
