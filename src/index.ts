// Express server
import express from 'express';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';

// Express WS
import expressWs from 'express-ws';

// LowDB
import { JSONFilePreset } from 'lowdb/node'

// Serial
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

let port;
let parser: ReadlineParser;

const __dirname = '/home/manitej/apocalypse';

const inner = expressWs(express());
const app = inner.app;
        
const db = await JSONFilePreset('db.json', { count: 0 })
await db.write();

// Process the truths.yaml file into a list of truths
import yaml from 'js-yaml';
import fs from 'fs';

const truths = (yaml.load(fs.readFileSync('truths.yaml', 'utf8')) as any).truths as [string];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

app.get('/', async (req, res) => {
    // Set headers to plain text
    res.setHeader('Content-Type', 'text/plain');

    // Join the truths into a string, from 0 to count
    await db.read();

    let truthString;

    if (db.data.count > truths.length) {
        truthString = truths.join('\n\n');
    } else {
        truthString = truths.slice(0, db.data.count).join('\n\n');
    }

    if (truthString.length === 0) {
        res.send('No truths have been revealed yet.');
        return;
    }

    res.send(truthString);
});

app.get('/memories', async (req, res) => {
    // Send the memories web page
    res.sendFile('/home/manitej/apocalypse/memories.html');
});

const acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/apng'];

app.post('/remembrance', async (req, res) => {
    // Retrieve form data from the request
    //    type="file" name="fileToUpload" id="fileToUpload"

    res.setHeader('Content-Type', 'text/plain');

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('Memory missing.');
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    const fileToUpload = req.files.fileToUpload;

    // Check if fileToUpload is an array
    if (Array.isArray(fileToUpload)) {
        res.send('Memory corrupted.');
        return;
    }

    const uploadPath = __dirname + '/upload/' + fileToUpload.name;

    // Check if the file is an image
    if (!acceptedTypes.includes(fileToUpload.mimetype)) {
        res.send('Memory fragmented.');
        return;
    }

    // Use the mv() method to place the file somewhere on your server
    fileToUpload.mv(uploadPath, async (err) => {
        if (err) {
            return res.status(500).send(err);
        }

        // Increment the count
        await db.read();
        db.data.count++;
        await db.write();

        res.send('A relevation appears...');

        inner.getWss().clients.forEach(async (client) => {
            await db.read();
            const count = db.data.count;
        
            if (count === 0) {
                client.send('No relevation has been made yet.');
            } else if (count > truths.length) {
                client.send(truths[truths.length - 1]);
            } else {
                client.send(truths[count - 1]);
            }
        });
    });    
});

app.get('/relevation', async (req, res) => {
    // Return the most recent relevation
    await db.read();
    const count = db.data.count;

    res.setHeader('Content-Type', 'text/plain');

    if (count === 0) {
        res.send('No relevation has been made yet.');
        return;
    } else if (count > truths.length) {
        res.send(truths[truths.length - 1]);
        return;
    } else {
        res.send(truths[count - 1]);
        return;
    }
});

app.ws('/relevation', async (ws, req) => {
    await db.read();
    const count = db.data.count;
    
    if (count === 0) {
        ws.send('No relevation has been made yet.');
    } else if (count > truths.length) {
        ws.send(truths[truths.length - 1]);
    } else {
        ws.send(truths[count - 1]);
    }
});

app.listen(55307, () => {
    console.log('Server is running on 55307');
});