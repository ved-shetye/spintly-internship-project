// App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Box} from '@chakra-ui/react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Upload from './components/Upload';
import Form from './components/Form';
import AssignCredForm from './components/AssignCredForm';

const App = () => {
  return (
    <Router>
      <Box>
        <TopBar />
        <Box display="flex">
          <Sidebar />
          <Box flex="1" ml="60px" mt="60px" p="4">
            <Routes>
              <Route path="/upload" element={<Upload />} />
              <Route path="/form" element={<Form />} />
              {/* Pass onSuccess prop to AssignCredForm */}
              <Route
                path="/assign-credentials"
                element={<AssignCredForm/>}
              />
              <Route path="/" element={<Upload />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </Router>
  );
};

export default App;
