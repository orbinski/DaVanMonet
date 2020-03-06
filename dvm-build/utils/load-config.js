/**
 * @file Load config files and cread the config object for DvM
 */

const path = require("path");
const yaml = require("js-yaml");
const fs = require("fs");
const _ = require("lodash");
const globby = require("globby");
const config_schema = require("../schema/config-schema");
const json_validator = new (require("jsonschema").Validator)();

// These can be used to get resolved, absolute paths
const configHelperMethods = function() {
  this.src_abs = function() {
    return path.resolve(process.cwd(), this.directories.src);
  };

  this.dist_web_abs = function() {
    return path.resolve(process.cwd(), this.directories.dist_web);
  };

  this.dist_package_abs = function() {
    return path.resolve(process.cwd(), this.directories.dist_package);
  };

  this.indexes_abs = function() {
    return path.resolve(process.cwd(), this.directories.indexes);
  };

  this.configs_abs = function() {
    return path.resolve(process.cwd(), this.directories.configs);
  };

  this.cssCopies_abs = function() {
    return path.resolve(process.cwd(), this.directories.cssCopies);
  };

  // This one needs special attention, since it might be empty
  this.userconfig_abs = function() {
    if (this.userconfig && this.userconfig.lenth > 0)
      return path.resolve(process.cwd(), this.userconfig);
    else return this.userconfig;
  };
};

const defaults = {
  project_info: {
    pagedata_schemaversion: "1.0"
  },
  directories: {
    public_path: "/",
    use_hash: false
  },
  userconfig: path.resolve(__dirname, "../../configs/local-conf.yml"),
  indexing: {
    contentIndexOutput: "contentindex.json",
    targetIndexOutput: "targetindex.json"
  },
  env: {
    devSitePort: 9001
  }
};

const isType = (val, type) =>
  typeof val === type &&
  (type !== "string" || (type === "string" && val.length > 0));
const getDirs = p =>
  fs.readdirSync(p).filter(f => fs.statSync(p + "/" + f).isDirectory());
const loadConfigFile = file_path =>
  file_path.indexOf(".json") !== -1
    ? require(file_path)
    : yaml.safeLoad(fs.readFileSync(file_path, "utf8"));

let cachedConfig = {
  dvmConfig: null,
  webpackConfig: null
};

exports.dvmConfig = function() {
  if (cachedConfig.dvmConfig !== null) {
    return cachedConfig.dvmConfig;
  } else {
    // Set path to the configFile set in package.json, or use deafult path
    var default_path = "configs/projectoptions.yml";
    var config_path =
      process.cwd() +
      "/" +
      (process.env.npm_package_config_configFile || default_path);

    if (fs.existsSync(config_path)) {
      // Load JSON or YAML base confg file
      const config = Object.assign(
        new configHelperMethods(),
        _.merge(defaults, loadConfigFile(config_path))
      );

      const validation = json_validator.validate(config, config_schema);
      if (validation.errors.length > 0) {
        console.error("Configuration Schema errors: ");
        validation.errors.forEach(e => console.error(e));
        throw new Error("Configuration Schema Error");
      }

      // If we have a user config file configured
      if (config.userconfig_abs().length > 0) {
        // Load JSON or YAML user config file
        try {
          const user_config = loadConfigFile(config.userconfig_abs());
          const base_config = loadConfigFile(config_path);

          // Merge to a single config
          config = new config_schema(_.merge(base_config, user_config));
        } catch (e) {
          console.warn(
            "Failed to load user config (does " +
              config.userconfig_abs() +
              " exit?)"
          );
        }
      }

      // Assign structureFolders. Take structure from config if set, otherwise map file system. Save result to co config.
      config.structureFolders =
        config.structure !== null && config.structure.length > 0
          ? config.structure
          : getDirs(config.directories.src).map(folder => {
              return {
                title: folder.charAt(0).toUpperCase() + folder.substr(1),
                path: folder
              };
            });

      // Expand targets as entries
      config.compilation.entry = {};
      for (target_name of Object.keys(config.compilation.targets)) {
        // Glob all the globs
        let e = globby
          .sync(config.compilation.targets[target_name], {
            cwd: config.src_abs()
          })
          .map(relPath => config.src_abs() + "/" + relPath); // Fix relative paths

        config.compilation.entry[target_name] = e;
      }

      // Make sure this property exists
      if (typeof config.directories.public_path !== "string") {
        config.directories.public_path = "/";
      }

      cachedConfig.dvmConfig = config;

      return config;
    } else {
      console.error("File does not exist (" + config_path + ")");
    }
  }
};

exports.getProjectPLConfig = function() {
  if (cachedConfig.webpackConfig !== null) {
    return cachedConfig.webpackConfig;
  } else {
    // Set path to the webpackConfig file set in package.json, or use deafult path
    var default_path = process.cwd() + "/config/webpack.conf.js";
    var config_path =
      process.cwd() + "/" + process.env.npm_package_config_webpackConfig ||
      default_path;

    if (fs.existsSync(config_path)) {
      var config = require(config_path);
      cachedConfig.webpackConfig = config;
    } else {
      cachedConfig.webpackConfig = {};
    }

    return cachedConfig.webpackConfig;
  }
};
