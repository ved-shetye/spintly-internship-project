// src/components/Upload.js
import React, { useState } from 'react';
import axios from 'axios';
import { Box, Button, Input, useToast, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

const Upload = () => {
  const [file, setFile] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'No file selected.',
        description: 'Please select a file to upload.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/upload', formData);
      console.log('File uploaded successfully:', response.data);

      toast({
        title: 'File uploaded.',
        description: "Your file has been uploaded successfully.",
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Navigate to the form component
      navigate('/form');
    } catch (error) {
      console.error('Error uploading file:', error.response ? error.response.data : error.message);

      toast({
        title: 'Upload failed.',
        description: `There was an error uploading your file. ${error.response ? error.response.data.message : error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p="4" pt="20px">
      <Text pb="20px" fontSize="larger" fontWeight="bold">Upload Excel Sheet</Text>
      <Input type="file" onChange={handleFileChange} alignContent="center" />
      <Button onClick={handleUpload} mt="4" colorScheme="orange">
        Upload
      </Button>
    </Box>
  );
};

export default Upload;
