const { getDefaultConfig } = require('expo/metro-config');
const { withKeepSnappy } = require('@keepsnappy/react-native/metro');

// Without KEEPSNAPPY=1 in the build environment withKeepSnappy returns the config unchanged.
module.exports = withKeepSnappy(getDefaultConfig(__dirname));
