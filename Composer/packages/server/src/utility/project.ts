// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';

import { remove } from 'fs-extra';
import formatMessage from 'format-message';
import { UserIdentity } from '@botframework-composer/types';
import { ServerWorker } from '@bfc/server-workers';

import { ExtensionContext } from '../models/extension/extensionContext';
import { LocationRef } from '../models/bot/interface';
import settings from '../settings';
import log from '../logger';
import AssetService from '../services/asset';
import { BotProject } from '../models/bot/botProject';
import { BackgroundProcessManager } from '../services/backgroundProcessManager';

import { Path } from './path';

export function getLocationRef(location: string, storageId: string, name: string) {
  // default the path to the default folder.
  let path = settings.botsFolder;
  // however, if path is specified as part of post body, use that one.
  // this allows developer to specify a custom home for their bot.
  if (location) {
    // validate that this path exists
    // prettier-ignore
    if (fs.existsSync(location)) { // lgtm [js/path-injection]
      path = location;
    }
  }
  const locationRef: LocationRef = {
    storageId,
    path: Path.resolve(path, name),
  };
  log('Attempting to create project at %s', path);
  return locationRef;
}

export async function getNewProjRef(
  templateDir: string,
  templateId: string,
  locationRef: LocationRef,
  user?: UserIdentity,
  locale?: string
) {
  const createFromRemoteTemplate = !!templateDir;
  let newProjRef;
  if (createFromRemoteTemplate) {
    log('Creating project from remote template at %s', templateDir);
    newProjRef = await AssetService.manager.copyRemoteProjectTemplateTo(templateDir, locationRef, user, locale);
    // clean up the temporary template directory -- fire and forget
    remove(templateDir);
  } else {
    log('Creating project from internal template %s', templateId);
    newProjRef = await AssetService.manager.copyProjectTemplateTo(templateId, locationRef, user, locale);
  }
  return newProjRef;
}

export async function ejectAndMerge(currentProject: BotProject, jobId: string) {
  if (currentProject.settings?.runtime?.customRuntime === true) {
    const runtime = ExtensionContext.getRuntimeByProject(currentProject);
    const runtimePath = currentProject.getRuntimePath();
    if (runtimePath) {
      if (!fs.existsSync(runtimePath)) {
        if (runtime.eject) {
          await runtime.eject(currentProject, currentProject.fileStorage);
        } else {
          log('Eject skipped for project with invalid runtime setting');
        }
      }

      // TO-DO: Remove this once the SDK packages are public on Nuget instad of Myget
      // Inject a Nuget.config file into the project so that pre-release packages can be resolved.
      fs.writeFileSync(
        Path.join(runtimePath, 'Nuget.config'),
        `<?xml version="1.0" encoding="utf-8"?>
      <configuration>
        <packageSources>
          <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
          <add key="BotBuilder.myget.org" value="https://botbuilder.myget.org/F/botbuilder-v4-dotnet-daily/api/v3/index.json" protocolVersion="3" />
        </packageSources>
      </configuration>`
      );

      // install all dependencies and build the app
      BackgroundProcessManager.updateProcess(jobId, 202, formatMessage('Building runtime'));
      await runtime.build(runtimePath, currentProject);

      const manifestFile = runtime.identifyManifest(currentProject.dataDir, currentProject.name);

      // run the merge command to merge all package dependencies from the template to the bot project
      BackgroundProcessManager.updateProcess(jobId, 202, formatMessage('Merging Packages'));
      await ServerWorker.execute('dialogMerge', { manifestFile, currentProjectDataDir: currentProject.dataDir });
    } else {
      log('Schema merge step skipped for project without runtime path');
    }
  }
}
