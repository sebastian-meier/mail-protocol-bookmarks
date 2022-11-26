
const moment = require('moment');

module.exports = function(config) {

  // A useful way to reference the context we are runing eleventy in
  let env = process.env.ELEVENTY_ENV;

  // Layout aliases can make templates more portable
  config.addLayoutAlias('default', 'layouts/base.njk');

  config.addCollection("bookmarks", (collectionApi) => {
    return collectionApi
      .getAllSorted()
      .filter(b => b.inputPath.includes('/bookmarks/'))
      .map(b => {
        return b.data;
      });
  });

  config.addCollection("bookmarkTags", (collectionApi) => {
    const tags = {};
    collectionApi
      .getAllSorted()
      .filter(b => b.inputPath.includes('/bookmarks/'))
      .forEach(b => {
      const bTags = ((typeof b.data.tags) === 'object') ? b.data.tags : [b.data.tags];
      bTags.forEach(t => {
        t = t.toLowerCase();
        if (!(t in tags)) {
          tags[t] = 0;
        }
        tags[t]++;
      });
    });
    return Object.keys(tags).sort().map(t => {
      return {
        name: t,
        count: tags[t] 
      }
    });
  });

  // compress and combine js files
  config.addFilter("jsmin", function(code) {
    const UglifyJS = require("uglify-js");
    let minified = UglifyJS.minify(code);
      if( minified.error ) {
          console.log("UglifyJS error: ", minified.error);
          return code;
      }
      return minified.code;
  });

  config.addNunjucksFilter("date", function (date, format, locale) {
    locale = locale ? locale : "en";
    moment.locale(locale);
    return moment(date).format(format);
  });

  // pass some assets right through
  config.addPassthroughCopy("./src/site/fonts");
  config.addPassthroughCopy("./src/site/assets");

  // make the seed target act like prod
  env = (env=="seed") ? "prod" : env;
  return {
    dir: {
      input: "src/site",
      output: "dist"
    },
    templateFormats : ["njk", "md", "11ty.js"],
    htmlTemplateEngine : "njk",
    markdownTemplateEngine : "njk",
    passthroughFileCopy: true
  };

};