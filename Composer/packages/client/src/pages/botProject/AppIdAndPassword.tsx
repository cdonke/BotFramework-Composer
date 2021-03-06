// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { jsx, css } from '@emotion/core';
import { useRecoilValue } from 'recoil';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import formatMessage from 'format-message';
import { FontSizes } from 'office-ui-fabric-react/lib/Styling';
import { SharedColors } from '@uifabric/fluent-theme';
import { Link } from 'office-ui-fabric-react/lib/Link';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';

import { dispatcherState, settingsState } from '../../recoilModel';
import { mergePropertiesManagedByRootBot } from '../../recoilModel/dispatchers/utils/project';
import { rootBotProjectIdSelector } from '../../recoilModel/selectors/project';

import { inputFieldStyles, subtext, title } from './styles';
import { GetAppInfoFromPublishProfileDialog } from './GetAppInfoFromPublishProfileDialog';
// -------------------- Styles -------------------- //

const labelContainer = css`
  display: flex;
  flex-direction: row;
`;

const customerLabel = css`
  font-size: ${FontSizes.small};
  margin-right: 5px;
`;

const unknownIconStyle = (required) => {
  return {
    root: {
      selectors: {
        '&::before': {
          content: required ? " '*'" : '',
          color: SharedColors.red10,
          paddingRight: 3,
        },
      },
    },
  };
};

const appIdAndPasswordStyle = css`
  display: flex;
  flex-direction: column;
`;

// -------------------- AppIdAndPassword -------------------- //

type AppIdAndPasswordProps = {
  projectId: string;
};

const onRenderLabel = (props) => {
  return (
    <div css={labelContainer}>
      <div css={customerLabel}> {props.label} </div>
      <TooltipHost content={props.label}>
        <Icon iconName="Unknown" styles={unknownIconStyle(props.required)} />
      </TooltipHost>
    </div>
  );
};

export const AppIdAndPassword: React.FC<AppIdAndPasswordProps> = (props) => {
  const { projectId } = props;
  const { MicrosoftAppId, MicrosoftAppPassword } = useRecoilValue(settingsState(projectId));
  const [localMicrosoftAppId, setLocalMicrosoftAppId] = useState<string>('');
  const [localMicrosoftAppPassword, setLocalMicrosoftAppPassword] = useState<string>('');
  const { setSettings } = useRecoilValue(dispatcherState);
  const rootBotProjectId = useRecoilValue(rootBotProjectIdSelector) || '';
  const settings = useRecoilValue(settingsState(projectId));
  const mergedSettings = mergePropertiesManagedByRootBot(projectId, rootBotProjectId, settings);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    setLocalMicrosoftAppId(MicrosoftAppId ?? '');
    setLocalMicrosoftAppPassword(MicrosoftAppPassword ?? '');
  }, [projectId]);

  const handleAppIdOnChange = (e, value) => {
    setLocalMicrosoftAppId(value);
  };

  const handleAppPasswordOnChange = (e, value) => {
    setLocalMicrosoftAppPassword(value);
  };

  const handleAppPasswordOnBlur = useCallback(() => {
    setSettings(projectId, {
      ...mergedSettings,
      MicrosoftAppPassword: localMicrosoftAppPassword,
    });
  }, [projectId, mergedSettings, localMicrosoftAppPassword]);

  const handleAppIdOnBlur = useCallback(() => {
    setSettings(projectId, {
      ...mergedSettings,
      MicrosoftAppId: localMicrosoftAppId,
    });
  }, [projectId, mergedSettings, localMicrosoftAppId]);

  const handleAddFromProfile = (appId: string, appPassword: string) => {
    setLocalMicrosoftAppId(appId);
    setLocalMicrosoftAppPassword(appPassword);
    setSettings(projectId, {
      ...mergedSettings,
      MicrosoftAppId: appId,
      MicrosoftAppPassword: appPassword,
    });
  };

  return (
    <Fragment>
      <div css={title}>{formatMessage('Microsoft App ID')}</div>
      <div css={subtext}>
        {formatMessage.rich(
          'An App ID is used for communication between your bot and skills, services, websites or applications. Use an existing App ID or automatically generate an App ID when creating a publishing profile for this bot. <a>Learn more</a>',
          {
            a: ({ children }) => (
              <Link key="app-id-settings-page" href={'https://aka.ms/composer-appid-learnmore'} target="_blank">
                {children}
              </Link>
            ),
          }
        )}
      </div>
      <div css={appIdAndPasswordStyle}>
        <TextField
          ariaLabel={formatMessage('Microsoft App Id')}
          data-testid={'MicrosoftAppId'}
          label={formatMessage('Microsoft App Id')}
          placeholder={formatMessage('Type App Id')}
          styles={inputFieldStyles}
          value={localMicrosoftAppId}
          onBlur={handleAppIdOnBlur}
          onChange={handleAppIdOnChange}
          onRenderLabel={onRenderLabel}
        />
        <TextField
          ariaLabel={formatMessage('Microsoft App Password')}
          data-testid={'MicrosoftPassword'}
          label={formatMessage('Microsoft App Password')}
          placeholder={formatMessage('Type App Password')}
          styles={inputFieldStyles}
          value={localMicrosoftAppPassword}
          onBlur={handleAppPasswordOnBlur}
          onChange={handleAppPasswordOnChange}
          onRenderLabel={onRenderLabel}
        />
        <PrimaryButton
          styles={{ root: { width: '230px', marginTop: '15px' } }}
          text={formatMessage('Retrieve App ID')}
          onClick={() => {
            setShowImportDialog(true);
          }}
        />
      </div>
      {showImportDialog && (
        <GetAppInfoFromPublishProfileDialog
          hidden={!showImportDialog}
          projectId={projectId}
          onCancel={() => {
            setShowImportDialog(false);
          }}
          onOK={(info) => {
            setShowImportDialog(false);
            handleAddFromProfile(info.appId, info.appPassword || '');
          }}
        />
      )}
    </Fragment>
  );
};
