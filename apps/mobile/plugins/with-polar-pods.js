const { withPodfile } = require("expo/config-plugins");
// Polar SDK 6.16 brings privacy bundle pods with deployment targets below the
// minimum accepted by recent Xcode. Keep the generated Podfile reproducible.
module.exports = (config) =>
  withPodfile(config, (mod) => {
    if (!mod.modResults.contents.includes("# apexVIP Polar minimum")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        "post_install do |installer|",
        `post_install do |installer|
    # apexVIP Polar minimum
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('15.1')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`,
      );
    }
    return mod;
  });
