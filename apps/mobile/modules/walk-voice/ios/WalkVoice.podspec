Pod::Spec.new do |s|
  s.name           = 'WalkVoice'
  s.version        = '1.0.0'
  s.summary        = 'Spoken walk prompts that duck other audio'
  s.author         = ''
  s.homepage       = 'https://github.com/walkwhile'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end
