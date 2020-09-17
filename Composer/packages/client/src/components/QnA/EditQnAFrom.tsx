// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';
import { QnAFile } from '@bfc/shared';

import { getQnAFileUrlOption } from '../../utils/qnaUtil';

import EditQnAFromScratchModal, { EditQnAFromScratchFormData } from './EditQnAFromScratchModal';
import EditQnAFromUrlModal, { EditQnAFromUrlFormData } from './EditQnAFromUrlModal';

interface EditQnAModalProps {
  qnaFiles: QnAFile[];
  qnaFile: QnAFile;
  onDismiss: () => void;
  onSubmit: (formData: EditQnAFromScratchFormData | EditQnAFromUrlFormData) => void;
}

export const EditQnAModal: React.FC<EditQnAModalProps> = (props) => {
  const url = getQnAFileUrlOption(props.qnaFile);

  if (url) {
    return <EditQnAFromUrlModal {...props}></EditQnAFromUrlModal>;
  } else {
    return <EditQnAFromScratchModal {...props}></EditQnAFromScratchModal>;
  }
};

export default EditQnAModal;
