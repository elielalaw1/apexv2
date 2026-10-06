require 'xcodeproj'
# Add a reproducible UI test target to the generated native project only.
project_path = File.expand_path('../ios/apexVIP.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'apexVIP' }
raise 'Run expo prebuild first' unless app
name = 'ApexVIPUITests'
target = project.targets.find { |item| item.name == name }
unless target
  target = project.new_target(:ui_test_bundle, name, :ios, '15.1', nil, :swift)
  group = project.new_group('APEX UI Tests', '../tests')
  file = group.new_file('MobileUITests.swift')
  target.source_build_phase.add_file_reference(file)
  target.add_dependency(app)
end
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'GENERATE_INFOPLIST_FILE' => 'YES', 'PRODUCT_BUNDLE_IDENTIFIER' => 'se.apex.vip.uitests',
    'PRODUCT_NAME' => name, 'PRODUCT_MODULE_NAME' => name, 'TEST_TARGET_NAME' => 'apexVIP', 'SWIFT_VERSION' => '5.0', 'CODE_SIGNING_ALLOWED' => 'YES', 'CODE_SIGN_IDENTITY' => '-',
    'IPHONEOS_DEPLOYMENT_TARGET' => '15.1', 'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project_path, name, true)
puts "Prepared #{name} in generated project"
