const config = {
  outputFileTracingIncludes: {
    '/api/site-check': ['./.generated/site-check/index.json'],
    '/api/site-check/*': ['./.generated/site-check/index.json'],
  },
};
export default config;
