// @todo: remove the following line when part imports has been removed from this file
///<reference types="@sanity/types/parts" />

import {storiesOf} from 'part:@sanity/storybook'
import {withKnobs} from 'part:@sanity/storybook/addons/knobs'
import {DefaultStory} from './stories/default'
import {SpacingTestStory} from './stories/spacingTest'

storiesOf('@sanity/components/textfields', module)
  .addDecorator(withKnobs)
  .add('Default', DefaultStory)
  .add('Spacing test', SpacingTestStory)
