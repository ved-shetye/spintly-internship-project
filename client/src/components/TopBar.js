// src/components/TopBar.js
import React from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';

const TopBar = () => {
  return (
    <Box
      as="header"
      position="fixed"
      top="0"
      left="0"
      width="100%"
      bg="orange.500"
      color="white"
      p="3"
      zIndex="1000"
      boxShadow="md"
    >
      <Flex align="center" ml="80px">
        <Text fontSize="xl" fontWeight="bold" color="white">
          Spintly
        </Text>
      </Flex>
    </Box>
  );
};

export default TopBar;
