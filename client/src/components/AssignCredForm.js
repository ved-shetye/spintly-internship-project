import React, { useState } from 'react';
import axios from 'axios';
import { Box, Button, Input, FormControl, FormLabel, useToast, Text, Spinner } from '@chakra-ui/react';

const AssignCredForm = ({ onSuccess }) => {
  const [orgId2, setOrgId2] = useState('');
  const [authToken2, setAuthToken2] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [excelBlobUrl, setExcelBlobUrl] = useState(null); // State to hold the generated Excel file URL
  const toast = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setProgress(0);

    try {
      // Fetch matched users data
      const { data: users } = await axios.get('http://localhost:8000/matched-users', {
        headers: { Authorization: authToken2 }
      });

      const responses = [];
      const totalUsers = users.length;
      let completedRequests = 0;

      // Assign credentials to each user
      for (const user of users) {
        try {
          const accessCardNumber = user['access_card'];
          const response = await axios.post(
            `https://saams.api.spintly.com/organisationManagement/v1/organisations/${orgId2}/users/${user.user_id}/assignCredential`,
            { cardType: 'spintly_card', cardId: accessCardNumber },
            { headers: { Authorization: authToken2, 'Content-Type': 'application/json' } }
          );
          responses.push({ userId: user.user_id, response: response.data });
        } catch (error) {
          responses.push({ userId: user.user_id, error: error.message });
        } finally {
          completedRequests += 1;
          setProgress((completedRequests / totalUsers) * 100);
        }
      }

      // Save responses to server
      await axios.post('http://localhost:8000/save-responses', { responses }, {
        headers: { 'Content-Type': 'application/json' }
      });

      // Generate updated Excel file and store Blob URL
      const updatedFile = await axios.post('http://localhost:8000/generate-excel', {
        responses
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([updatedFile.data]));
      setExcelBlobUrl(url);

      // Notify success
      toast({
        title: 'Form submitted.',
        description: 'Credentials assigned successfully. Excel file is ready for download.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Trigger onSuccess callback
    } catch (error) {
      console.error('Error submitting form: User not found', error.response ? error.response.data : error.message);

      toast({
        title: 'Submission failed.',
        description: `There was an error submitting the form. ${error.response ? error.response.data.message : error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (excelBlobUrl) {
      const link = document.createElement('a');
      link.href = excelBlobUrl;
      link.setAttribute('download', 'updated-file.xlsx');
      document.body.appendChild(link);
      link.click();
    }
  };

  const handleDownloadUnmatchedExcel = async () => {
    try {
      const response = await axios.get('http://localhost:8000/download-unmatched-excel', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'card_assignment_failure.xlsx');
      document.body.appendChild(link);
      link.click();
      toast({
        title: 'Download successful.',
        description: 'Unmatched users Excel file is ready for download.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error downloading unmatched Excel file:', error);
      toast({
        title: 'Download failed.',
        description: `There was an error downloading the Excel file. ${error.response ? error.response.data.message : error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p="4" pt="20px">
      <Text pb="20px" fontSize="larger" fontWeight="bold">Assign Credentials</Text>
      <form onSubmit={handleSubmit}>
        <FormControl id="orgId2" mb="4">
          <FormLabel>Organization ID</FormLabel>
          <Input
            type="text"
            value={orgId2}
            onChange={(e) => setOrgId2(e.target.value)}
            required
          />
        </FormControl>
        <FormControl id="authToken2" mb="4">
          <FormLabel>Authentication Token</FormLabel>
          <Input
            type="text"
            value={authToken2}
            onChange={(e) => setAuthToken2(e.target.value)}
            required
          />
        </FormControl>
        <Button type="submit" colorScheme="orange" isDisabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Submit'}
        </Button>
      </form>
      {loading && (
        <Box mt={4}>
          <Text>Progress: {Math.round(progress)}%</Text>
          <Box height="10px" bg="gray.200" borderRadius="md">
            <Box height="100%" width={`${progress}%`} bg="teal.500" borderRadius="md" />
          </Box>
        </Box>
      )}
      <Box mt={4}>
        <Button onClick={handleDownloadUnmatchedExcel} colorScheme="teal">
          To get list of Users not found
        </Button>
      </Box>
      {excelBlobUrl && (
        <Box mt={4}>
          <Button onClick={handleDownloadExcel} colorScheme="teal">
            Download Updated Excel
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AssignCredForm;
