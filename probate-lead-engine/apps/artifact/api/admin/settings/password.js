const { handleAdminSettings } = require("./_shared");

module.exports = async function handler(request, response) {
  return handleAdminSettings(request, response, "rotate");
};
