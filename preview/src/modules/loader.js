import _ from 'lodash';
import Yaml from 'js-yaml';

export default class Loader
{
    static async loadJSONorYAML(path)
    {
        var request = await fetch(path);
        if(request.status !== 404)
        {
            if(path.indexOf('.json') !== -1)
            {
                return await request.json()
            }
            else
            {
                const yamlText = await request.text();
                return Yaml.safeLoad(yamlText);
            }
        }
    }
    
    static async LoadData()
    {
        if (Loader.HasLoaded)
            return; 
        
        const requestbase = "//" + window.location.host + "/";
        
        // Main config will be imported by Webpack via an appropriate loader
        const mainconfig = require(__CONFIG_PATH__);

        const contentindex = require("./indexes/contentindex.json");
        console.log(contentindex);

        if(typeof mainconfig !== "object")
        {
            console.error('Could not parse project config ('+ __CONFIG_PATH__ + ')');
            return;
        }
        
        // Look for user config and extend the default config if present
        if(typeof mainconfig.userconfig === "string" && mainconfig.userconfig.length > 0)
        {
            let userConfig =  await this.loadJSONorYAML(requestbase + mainconfig.userconfig);
            if(typeof userConfig === "object")
            {
                _.merge(mainconfig, userConfig);
            }
        }
        Loader.ProjectConfig = mainconfig;

        // Fetch content index
        const contentIndexPath = requestbase + Loader.ProjectConfig.directories.indexes + '/' + Loader.ProjectConfig.indexing.contentindexoutput;
        const contentIndexReq = await fetch(contentIndexPath);
        if(contentIndexReq.status !== 404)
        {
            Loader.ContentIndex = await contentIndexReq.json();
        }
        else
        {
            console.error('Unable to load Content Index ('+ contentIndexPath +')');
            return;
        }

        // Fetch css target index
        const targetIndexPath = requestbase + Loader.ProjectConfig.directories.indexes + '/' + Loader.ProjectConfig.indexing.targetindexoutput;
        const targetIndexReq = await fetch(targetIndexPath);
        if(targetIndexReq.status !== 404)
        {
            Loader.TargetIndex = await targetIndexReq.json();
        }
        else
        {
            console.error('Unable to load Target Index ('+ targetIndexPath +')')
        }
        Loader.HasLoaded = true;
    }
}

Loader.ContentIndex = {};
Loader.TargetIndex = {};
Loader.ProjectConfig = {};
Loader.HasLoaded = false;

//return Loader;
//}));