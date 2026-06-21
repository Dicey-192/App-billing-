export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

/**
 * Uploads the application state as a JSON backup to the user's Google Drive.
 */
export async function uploadBackupToDrive(accessToken: string, data: any): Promise<{ id: string; name: string }> {
  try {
    const filename = `artha_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      description: 'Artha Billing System automatic/manual cloud backup',
    };
    
    const fileContent = JSON.stringify(data, null, 2);
    const boundary = '---------cloud_backup_boundary_artha_drive---------';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const body = delimiter +
      'Content-type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      close_delim;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive upload failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const result = await response.json();
    return { id: result.id, name: result.name };
  } catch (error) {
    console.error('[GoogleDrive] Upload crash:', error);
    throw error;
  }
}

/**
 * Lists the available backup files on the user's Google Drive.
 */
export async function listBackupsFromDrive(accessToken: string): Promise<DriveBackupFile[]> {
  try {
    const q = encodeURIComponent("name contains 'artha_backup' and mimeType = 'application/json' and trashed = false");
    const fields = encodeURIComponent("files(id, name, createdTime, size)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime%20desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive list failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const result = await response.json();
    return result.files || [];
  } catch (error) {
    console.error('[GoogleDrive] List crash:', error);
    throw error;
  }
}

/**
 * Downloads the contents of a specific backup file from Google Drive.
 */
export async function downloadBackupFromDrive(accessToken: string, fileId: string): Promise<any> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive download failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const parsedData = await response.json();
    return parsedData;
  } catch (error) {
    console.error('[GoogleDrive] Download crash:', error);
    throw error;
  }
}
