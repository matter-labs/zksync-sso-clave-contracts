import fs from 'fs';
import { parseAbiItem } from 'viem';
import https from 'https';
import assert from 'assert';

function post(url: string, data: object) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: new URL(url).hostname,
      path: new URL(url).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(responseData));
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

(async function() {
  const request = {
    function: [] as string[],
  };

  const files = await fs.promises.readdir('./src', { recursive: true });
  for (const file of files) {
    if (file.endsWith('.sol')) {
      const content = fs.readFileSync(`./src/${file}`, 'utf-8');
      const matches = content.match(/\berror\s+\w+\([^;]*\);/g) ?? [];
      for (const match of matches) {
        const abiItem: any = parseAbiItem(match.replace(';', ''));
        const unparsed = `${abiItem.name}(${abiItem.inputs.map(input => input.type).join(',')})`;
        request.function.push(unparsed);
      }
    }
  }

  const response: any = await post("https://api.openchain.xyz/signature-database/v1/import", request);
  assert(response.ok, "POST request to api.openchain.xyz failed")
  assert(response.result.function.invalid === null, "Invalid data submitted -- parsing error?")

  const imported = Object.entries(response.result.function.imported).length;
  const duplicated = Object.entries(response.result.function.duplicated).length;

  console.log(`Imported ${imported} selectors; ${duplicated} duplicates`);
})()
