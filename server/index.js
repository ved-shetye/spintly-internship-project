const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Pool } = require('pg');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(express.json()); // JSON parsing middleware
app.use(cors()); // CORS middleware

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const responsesDir = path.join(__dirname, 'responses');
if (!fs.existsSync(responsesDir)) {
  fs.mkdirSync(responsesDir);
}

const upload = multer({ storage });

// Function to validate JWT format
function isValidToken(token) {
  const parts = token.split('.');
  return parts.length === 3;
}

// PostgreSQL client setup
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});


// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Request received:', req.file); // Check if multer parsed the file correctly

  if (!req.file) {
    console.error('No file uploaded.');
    return res.status(400).send({ message: 'No file uploaded.' });
  }

  try {
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    console.log('Using file:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log('Sheet data:', sheet);

    const client = await pool.connect();

    try {
      await client.query('BEGIN'); // Start transaction

      await client.query('TRUNCATE TABLE matched_table');
      await client.query('TRUNCATE TABLE unmatched_table');

      const excelEmails = sheet.map(row => row['Member Email']);

      const dbQuery = 'SELECT * FROM db';
      const dbResult = await client.query(dbQuery);
      const dbUsers = dbResult.rows;

      // Process matched and unmatched users
      for (const user of dbUsers) {
        const { user_id, name, email, unique_id } = user;
        const accessCard = null;

        if (excelEmails.includes(unique_id)) {
          // Matched entry
          const insertMatchedQuery = {
            text: 'INSERT INTO matched_table (user_id, name, email, unique_id, access_card) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING',
            values: [user_id, name, email, unique_id, accessCard]
          };

          await client.query(insertMatchedQuery);
          console.log(`Inserted into matched_table: ${user_id}, ${name}, ${email}, ${unique_id}, ${accessCard}`);
        } else {
          // Unmatched entry
          const insertUnmatchedQuery = {
            text: 'INSERT INTO unmatched_table (user_id, unique_id, email, access_card) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING',
            values: [user_id, unique_id, email, accessCard]
          };

          await client.query(insertUnmatchedQuery);
          console.log(`Inserted into unmatched_table: ${user_id}, ${unique_id}, ${email}, ${accessCard}`);
        }
      }

      await client.query('COMMIT'); // Commit transaction
      res.status(200).send({ message: 'Data processed successfully.' });
    } catch (error) {
      await client.query('ROLLBACK'); // Rollback transaction on error
      console.error('Error processing upload:', error);
      res.status(500).send({ message: 'Error processing upload.', error: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).send({ message: 'Error processing upload.', error: error.message });
  }
});

// New endpoint to handle API call
app.post('/fetch-users', async (req, res) => {
  const { orgId, authToken } = req.body;

  if (!orgId || !authToken) {
    return res.status(400).send({ message: 'Organization ID and authentication token are required.' });
  }

  if (!isValidToken(authToken)) {
    return res.status(400).send({ message: 'Invalid authentication token format.' });
  }

  try {
    const response = await axios.post(
      `https://saams.api.spintly.com/userManagement/integrator/v1/organisations/${orgId}/users`,
      {
        pagination: {
          page: 1,
          perPage: 25,
        },
        filters: {
          userType: ["active"],
          terms: [],
          sites: [],
        },
      },
      {
        headers: {
          Authorization: `${authToken}`,
        },
      }
    );

    const users = response.data.message.users.filter(user => user.uniqueId);

    console.log(`Fetched ${users.length} users with uniqueId.`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN'); // Start transaction

      await client.query('TRUNCATE TABLE db');

      for (const user of users) {
        const { id, name, email, uniqueId } = user;
        const query = {
          text: 'INSERT INTO db (user_id, name, email, unique_id, access_card) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, unique_id = EXCLUDED.unique_id, access_card = EXCLUDED.access_card',
          values: [id, name, email, uniqueId, null]
        };

        try {
          await client.query(query);
          console.log(`Inserted into db: ${id}, ${name}, ${email}, ${uniqueId}`);
        } catch (err) {
          console.error('Error inserting into db:', err);
          throw err;
        }
      }

      await client.query('COMMIT'); // Commit transaction
      res.status(200).send({ message: 'Users stored successfully.', data: users });
    } catch (error) {
      await client.query('ROLLBACK'); // Rollback transaction on error
      console.error('Error fetching users:', error);
      res.status(500).send({ message: 'Error fetching users.', error: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      res.status(error.response.status).send({ message: 'Error fetching users.', error: error.response.data });
    } else if (error.request) {
      console.error('Error request data:', error.request);
      res.status(500).send({ message: 'Error fetching users.', error: 'No response received from the server.' });
    } else {
      console.error('Error message:', error.message);
      res.status(500).send({ message: 'Error fetching users.', error: error.message });
    }
  }
});


// New endpoint to fetch matched users
app.get('/matched-users', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM matched_table');
    client.release();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching matched users:', error);
    res.status(500).json({ message: 'Error fetching matched users.', error: error.message });
  }
});

// Endpoint to save responses to file
app.post('/save-responses', async (req, res) => {
  try {
    const { responses } = req.body;

    if (!responses) {
      console.error('No responses found in the request body.');
      return res.status(400).json({ message: 'No responses provided.' });
    }

    const filePath = path.join(responsesDir, 'responses.json');
    console.log('Saving responses to:', filePath);

    try {
      fs.writeFileSync(filePath, JSON.stringify(responses, null, 2));
      console.log('Responses saved successfully.');
      res.status(200).json({ message: 'Responses saved successfully.' });
    } catch (error) {
      console.error('Error saving responses:', error);
      res.status(500).json({ message: 'Error saving responses.', error: error.message });
    }
  } catch (error) {
    console.error('Error saving responses:', error);
    res.status(500).json({ message: 'Error saving responses.', error: error.message });
  }
});

// Endpoint to generate and download updated Excel file
// Endpoint to generate Excel file
app.post('/generate-excel', async (req, res) => {
  try {
    const { responses, matched_table } = req.body;
    // Validate if responses are present
    if (!responses || responses.length === 0) {
      return res.status(400).json({ message: 'No responses provided.' });
    }

    // Get the latest uploaded Excel file from the uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir);
    const latestFile = files.filter(file => file.endsWith('.xlsx')).pop(); // Assuming latest file is the last one

    if (!latestFile) {
      return res.status(404).json({ message: 'No Excel file found in the uploads directory.' });
    }

    const filePath = path.join(uploadsDir, latestFile);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    let sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    // Update the sheet with responses
    sheet = await updateExcelSheet(sheet, responses, matched_table);

    // Create a new workbook with the updated sheet
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, XLSX.utils.json_to_sheet(sheet), sheetName);

    // Generate a buffer from the workbook
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${latestFile}`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).json({ message: 'Error generating Excel file.', error: error.message });
  }
});

// Function to update Excel sheet with responses
async function updateExcelSheet(sheet, responses, matched_table) {
  const headers = ['Member Email', 'User Id', 'Message']; // Define headers

  // Add new columns if they don't exist
  headers.forEach(header => {
    if (!sheet[0][header]) {
      sheet.forEach(row => {
        row[header] = ''; // Initialize new column with empty string
      });
    }
  });

  const client = await pool.connect(); // Create a new client connection
  try {
    // Fetch user_id and unique_id mapping from the PostgreSQL table
    const query = 'SELECT unique_id, user_id FROM matched_table';
    const result = await client.query(query);
    const dbMapping = result.rows;

    console.log('DB Mapping:', dbMapping);

    // Update the sheet with matched_table and responses
    sheet.forEach(row => {
      const uniqueId = row['Member Email']; // Adjust based on actual column name
      console.log('Processing row:', uniqueId);

      // Find corresponding user_id from dbMapping
      const matchedRow = dbMapping.find(entry => entry.unique_id === uniqueId);
      if (matchedRow) {
        const user_id = matchedRow.user_id;
        row['User Id'] = user_id;

        // Find corresponding response for user_id
        const response = responses.find(resp => resp.userId === user_id);
        if (response) {
          row['Message'] = response.data || response.error || '';
          console.log(`Updated row for user_id ${user_id}:`, row);
        } else {
          row['Message'] = 'No response found for this user_id';
          console.log(`No response found for user_id ${user_id}`);
        }
      } else {
        row['User Id'] = 'No Match';
        row['Message'] = 'No match found in the database';
        console.log(`No match found for unique_id ${uniqueId}`);
      }
    });

  } catch (error) {
    console.error('Error updating Excel sheet:', error);
    throw error; // Rethrow error to handle it in the calling function
  } finally {
    client.release(); // Release the client connection
  }

  return sheet;
}

// Endpoint to generate and download unmatched Excel file
app.get('/download-unmatched-excel', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM unmatched_table');
    client.release();

    const unmatchedUsers = result.rows;

    if (unmatchedUsers.length === 0) {
      return res.status(404).json({ message: 'No unmatched users found.' });
    }

    // Create a new workbook and add data
    const newWorkbook = XLSX.utils.book_new();
    const sheetData = [['User ID', 'Unique ID', 'Message']];

    unmatchedUsers.forEach(user => {
      sheetData.push([user.user_id, user.unique_id, 'User Not Found']);
    });

    const newSheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Unmatched Users');

    // Generate a buffer from the workbook
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=card_assignment_failure.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generating unmatched Excel file:', error);
    res.status(500).json({ message: 'Error generating unmatched Excel file.', error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
