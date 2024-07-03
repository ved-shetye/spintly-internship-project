// src/components/Sidebar.js
import React from 'react';
import { Box, VStack, Link, Icon } from '@chakra-ui/react';
import { FaHome, FaUser } from 'react-icons/fa';

const Sidebar = () => {
  return (
    <Box
      as="nav"
      position="fixed"
      top="12"
      left="0"
      h="100vh"
      width="60px"
      bg="orange.500"
      color="white"
      p="5"
    >
      <VStack spacing="10" align="start">
        <Link href="/">
          <Icon as={FaHome} mr="4" />
        </Link>
        <Link href="/profile">
          <Icon as={FaUser} mr="4" />
        </Link>
      </VStack>
    </Box>
  );
};

export default Sidebar;
