import { BrowserRouter } from "react-router-dom";
import MainRoutes from "./MainRoutes.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScrollToTop from "./ScrollToTop";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <ScrollToTop /> 
        <MainRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
