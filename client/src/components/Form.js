import React, { useState } from 'react';
import { Box, Button, Input, FormControl, FormLabel, useToast, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Form = () => {
  const [orgId, setOrgId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await axios.post('http://localhost:8000/fetch-users', {
        orgId,
        authToken,
      });

      toast({
        title: 'Form submitted.',
        description: `Users fetched and stored successfully. Total users: ${response.data.data.length}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      navigate('/assign-credentials');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Submission failed.',
        description: `There was an error submitting the form: ${error.response?.data?.message || error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p="4" pt="20px">
      <Text pb="20px" fontSize="larger" fontWeight="bold">Get Users</Text>
      <form onSubmit={handleSubmit}>
        <FormControl id="orgId" mb="4">
          <FormLabel>Organization ID</FormLabel>
          <Input
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          />
        </FormControl>
        <FormControl id="authToken" mb="4">
          <FormLabel>Authentication Token</FormLabel>
          <Input
            type="text"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            required
          />
        </FormControl>
        <Button type="submit" colorScheme="orange">Submit</Button>
      </form>
    </Box>
  );
};

export default Form;
