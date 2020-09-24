import { IBotProject } from '@bfc/shared';

import { PVAPublishJob, PublishConfig, PublishResponse, PublishResult, UserIdentity, PublishState } from './types';

const API_VERSION = '1';
//const BASE_URL = `https://powerva.microsoft.com/api/botmanagement/v${API_VERSION}`; // prod / sdf
const BASE_URL = `https://bots.int.customercareintelligence.net/api/botmanagement/v${API_VERSION}`; // int / ppe
const authCredentials = {
  clientId: 'ce48853e-0605-4f77-8746-d70ac63cc6bc',
  scopes: ['a522f059-bb65-47c0-8934-7db6e5286414/.default'], // int / ppe
};

interface PublishHistory {
  [botProjectId: string]: PublishProfileHistory;
}

interface PublishProfileHistory {
  [profileName: string]: PublishResult[];
}

// TODO: persistent history?
const publishHistory: PublishHistory = {};

export const publish = async (
  config: PublishConfig,
  project: IBotProject,
  metadata: any,
  user: UserIdentity,
  { getAccessToken, loginAndGetIdToken }
): Promise<PublishResponse> => {
  const {
    // these are provided by Composer
    profileName, // the name of the publishing profile "My PVA Prod Slot"

    // these are specific to the PVA publish profile shape
    botId,
    envId,
    tenantId,
    deleteMissingComponents, // publish behavior
  } = config;
  const { comment = '' } = metadata;

  try {
    // authenticate with PVA
    const idToken = await loginAndGetIdToken(authCredentials);
    const accessToken = await getAccessToken({ ...authCredentials, idToken });

    // initiate the publish job
    const url = `${BASE_URL}/environments/${envId}/bots/${botId}/composer/publishoperations?deleteMissingComponents=${deleteMissingComponents}&comment=${encodeURIComponent(
      comment
    )}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-CCI-TenantId': tenantId,
        'X-CCI-Routing-TenantId': tenantId,
      },
    });
    const job: PVAPublishJob = await res.json();

    // transform the PVA job to a publish response
    const status = 202; // accepted
    const result = xformJobToResult(job, status);

    // add to publish history
    const botProjectId = project.id;
    ensurePublishProfileHistory(botProjectId, profileName);
    publishHistory[botProjectId][profileName].unshift(result);

    return {
      status,
      result,
    };
  } catch (e) {
    return {
      status: 500,
      result: {
        message: e.message,
      },
    };
  }
};

export const getStatus = async (
  config: PublishConfig,
  project: IBotProject,
  user: UserIdentity,
  { getAccessToken, loginAndGetIdToken }
): Promise<PublishResponse> => {
  const {
    // these are provided by Composer
    profileName, // the name of the publishing profile "My PVA Prod Slot"

    // these are specific to the PVA publish profile shape
    botId,
    envId,
    tenantId,
  } = config;
  const botProjectId = project.id;

  const operationId = getOperationIdOfLastJob(botProjectId, profileName);
  if (!operationId) {
    // no last job
    return {
      status: 404,
      result: {
        message: `Could not find any publish history for project "${botProjectId}" and profile name "${profileName}"`,
      },
    };
  }

  try {
    // authenticate with PVA
    const idToken = await loginAndGetIdToken(authCredentials);
    const accessToken = await getAccessToken({ ...authCredentials, idToken });

    // check the status for the publish job
    const url = `${BASE_URL}/environments/${envId}/bots/${botId}/composer/publishoperations/${operationId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-CCI-TenantId': tenantId,
        'X-CCI-Routing-TenantId': tenantId,
      },
    });
    const job: PVAPublishJob = await res.json();

    // transform the PVA job to a publish response
    const status = res.status; // accepted
    const result = xformJobToResult(job, status);

    // update publish history
    const botProjectId = project.id;
    ensurePublishProfileHistory(botProjectId, profileName);
    publishHistory[botProjectId][profileName].shift();
    publishHistory[botProjectId][profileName].unshift(result);

    return {
      status,
      result,
    };
  } catch (e) {
    return {
      status: 500,
      result: {
        message: e.message,
      },
    };
  }
};

export const history = async (
  config: PublishConfig,
  project: IBotProject,
  user?: UserIdentity
): Promise<PublishResult[]> => {
  const {
    // these are provided by Composer
    profileName, // the name of the publishing profile "My PVA Prod Slot"
  } = config;
  const botProjectId = project.id;

  ensurePublishProfileHistory(botProjectId, profileName);
  return publishHistory[botProjectId][profileName];
};

const xformJobToResult = (job: PVAPublishJob, status: number): PublishResult => {
  const result: PublishResult = {
    comment: job.comment,
    id: job.operationId, // what is this used for in Composer?
    log: job.diagnostics.join('\n'),
    message: getUserFriendlyMessage(job.state),
    time: new Date(job.lastUpdateTimeUtc),
    status,
  };
  return result;
};

const ensurePublishProfileHistory = (botProjectId: string, profileName: string) => {
  if (!publishHistory[botProjectId]) {
    publishHistory[botProjectId] = {};
  }
  if (!publishHistory[botProjectId][profileName]) {
    publishHistory[botProjectId][profileName] = [];
  }
};

const getOperationIdOfLastJob = (botProjectId: string, profileName: string): string => {
  if (
    publishHistory[botProjectId] &&
    publishHistory[botProjectId][profileName] &&
    !!publishHistory[botProjectId][profileName].length
  ) {
    const mostRecentJob = publishHistory[botProjectId][profileName][0];
    return mostRecentJob.id;
  }
  // couldn't find any jobs for the bot project / profile name combo
  return '';
};

const getUserFriendlyMessage = (state: PublishState): string => {
  switch (state) {
    case 'Done':
      return 'Publish successful.';

    case 'Failed':
      return 'Publish failed. Please check logs.';

    case 'LoadingContent':
      return 'Loading bot content...';

    case 'PreconditionFailed':
      return 'Bot content out of sync. Please check logs.';

    case 'UpdatingSnapshot':
      return 'Updating bot content in PVA...';

    case 'Validating':
      return 'Validating bot assets...';

    default:
      return '';
  }
};
